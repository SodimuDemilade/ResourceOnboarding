import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  AccessRecommendation,
  OnboardingGuide,
  OnboardingIntake,
  RoleProfile,
  Task,
} from "@onboarding/shared";
import type { StructuredResult } from "../llm/structured.js";
import { runRoleAnalyst } from "../agents/roleAnalyst/agent.js";
import { runAccessTools } from "../agents/accessTools/agent.js";
import { runGuidance } from "../agents/guidance/agent.js";
import { getProject } from "../data/projectRespository.js";
import { buildTasks } from "./buildTasks.js";
import type { TaskTracker } from "../services/taskTracker.js";
import { findBlockers, type Blocker } from "../services/blockerRules.js";
import { summarise, type StatusSummary } from "../services/statusService.js";
import type { Tracer } from "../tracing/tracer.js";
import { config } from "../config.js";

// tsx watch restarts the server whenever you save a file.

// ---------- State: held by CODE, not by the model ----------

export type OrchestratorState = {
  role?: StructuredResult<RoleProfile>;
  access?: StructuredResult<AccessRecommendation>;
  guide?: StructuredResult<OnboardingGuide>;
  plan?: { tasks: Task[]; blockers: Blocker[]; status: StatusSummary };
  callCounts: Partial<Record<ToolName, number>>;
};

export type ToolContext = {
  caseId: string;
  intake: OnboardingIntake;
  tracker: TaskTracker;
  today: string;
  tracer: Tracer;
};

// ---------- Tool definitions: what the model sees ----------

const NoInput = z.object({});
const AskInput = z.object({ question: z.string().min(1).max(500) });
const FinishInput = z
  .object({ summary: z.string().min(1).max(2000) })
  .describe("Plain-language summary for the coordinator, under 250 words.");

export const INPUT_SCHEMAS: Record<ToolName, z.ZodObject> = {
  run_role_analysis: NoInput,
  run_access_planning: NoInput,
  run_guidance: NoInput,
  build_and_check_plan: NoInput,
  ask_coordinator: AskInput,
  finish: FinishInput,
};

function tool(
  name: string,
  description: string,
  input: z.ZodObject,
): Anthropic.Tool {
  const { $schema, ...schema } = z.toJSONSchema(input) as Record<
    string,
    unknown
  >;
  void $schema;
  return { name, description, input_schema: { type: "object", ...schema } };
}

export const TOOLS = [
  tool(
    "run_role_analysis",
    "Runs the Role & Project Analyst. Returns the joiner's responsibilities, tech stack and any missing information. Must succeed before access planning or guidance.",
    NoInput,
  ),
  tool(
    "run_access_planning",
    "Runs the Access & Tools specialist. Returns which project systems the joiner needs. Requires a successful role analysis.",
    NoInput,
  ),
  tool(
    "run_guidance",
    "Runs the Onboarding Guidance specialist. Writes the welcome and first-week plan. Requires a successful role analysis. Can run at the same time as access planning.",
    NoInput,
  ),
  tool(
    "build_and_check_plan",
    "Builds the onboarding tasks from the results so far, saves them, and returns blockers and status. Call after access planning.",
    NoInput,
  ),
  tool(
    "ask_coordinator",
    "Stops and asks the coordinator a question. Use only when missing information prevents a useful plan. Ends the run.",
    AskInput,
  ),
  tool(
    "finish",
    "Ends the run with a short summary for the coordinator: what was planned, what is blocked and what they need to do next.",
    FinishInput,
  ),
];

export type ToolName =
  | "run_role_analysis"
  | "run_access_planning"
  | "run_guidance"
  | "build_and_check_plan"
  | "ask_coordinator"
  | "finish";

export const TOOL_NAMES = TOOLS.map((t) => t.name) as ToolName[];

/** Runs one specialist and records an agent_call trace event for it. */
async function traced<T>(
  ctx: ToolContext,
  agent: string,
  run: () => Promise<StructuredResult<T>>,
): Promise<StructuredResult<T>> {
  const started = Date.now();
  const result = await run();
  ctx.tracer.record({
    kind: "agent_call",
    agent,
    model: config.models.specialist,
    ms: Date.now() - started,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    attempts: result.attempts,
    ok: result.ok,
    ...(result.ok ? {} : { failureReason: result.reason }),
  });
  return result;
}

/** Returns a summary for the model. Full state remains stored. */
export async function executeTool(
  name: ToolName,
  input: unknown,
  state: OrchestratorState,
  ctx: ToolContext,
): Promise<unknown> {
  const { projectId, roleId, seniority } = ctx.intake;

  switch (name) {
    case "run_role_analysis": {
      state.role = await traced(ctx, "role_analyst", () =>
        runRoleAnalyst({ projectId, roleId, seniority }),
      );
      return state.role.ok
        ? {
            ok: true,
            responsibilities: state.role.data.responsibilities.length,
            techStack: state.role.data.techStack,
            missingInformation: state.role.data.missingInformation,
          }
        : { ok: false, reason: state.role.reason, detail: state.role.detail };
    }
    case "run_access_planning": {
      if (!state.role?.ok) throw new Error("guard should have prevented this");
      const roleProfile = state.role.data;
      state.access = await traced(ctx, "access_tools", () =>
        runAccessTools({ projectId, roleId, roleProfile }),
      );
      return state.access.ok
        ? {
            ok: true,
            recommended: state.access.data.items.map((i) => i.catalogueId),
            missingInformation: state.access.data.missingInformation,
          }
        : { ok: false, reason: state.access.reason };
    }
    case "run_guidance": {
      if (!state.role?.ok) throw new Error("guard should have prevented this");
      const fullName = ctx.intake.fullName;
      const roleProfile = state.role.data;
      state.guide = await traced(ctx, "guidance", () =>
        runGuidance({ projectId, roleId, fullName, seniority, roleProfile }),
      );
      return state.guide.ok
        ? {
            ok: true,
            recommendedDocs: state.guide.data.recommendedDocs.map(
              (d) => d.docId,
            ),
            missingInformation: state.guide.data.missingInformation,
          }
        : { ok: false, reason: state.guide.reason };
    }
    case "build_and_check_plan": {
      const tasks = buildTasks({
        caseId: ctx.caseId,
        intake: ctx.intake,
        project: getProject(projectId),
        access: state.access?.ok ? state.access.data : null,
      });
      await ctx.tracker.saveTasks(ctx.caseId, tasks);
      const stored = await ctx.tracker.getTasks(ctx.caseId);
      const blockers = findBlockers(stored, {
        contractType: ctx.intake.contractType,
        startDate: ctx.intake.startDate,
        today: ctx.today,
      });
      state.plan = {
        tasks: stored,
        blockers,
        status: summarise(stored, blockers),
      };
      const notDone = stored.filter(
        (t) =>
          (t.stage === "compliance" || t.stage === "provisioning") &&
          t.status !== "done" &&
          t.status !== "rejected",
      );
      return {
        totalTasks: stored.length,
        status: state.plan.status,
        blockers: blockers.map((b) => `${b.kind}: ${b.taskId}: ${b.message}`),
        awaitingApproval: stored
          .filter((t) => t.status === "awaiting_approval")
          .map((t) => t.title),
        readiness: state.plan.status.readyToStart
          ? "Ready to start."
          : `Not ready: ${notDone.length} compliance or provisioning task(s) not done yet, and ${blockers.length} blocker(s).`,
        baselineAccessAdded: [
          "corporate-email",
          "team-chat",
          "jira",
          "confluence",
        ],
      };
    }
    case "ask_coordinator":
      return { question: AskInput.parse(input).question };
    case "finish":
      return { summary: FinishInput.parse(input).summary };
  }
}
