import { z } from "zod";
import { Status } from "./task.js";
import type { OnboardingIntake, ProjectId } from "./intake.js";
import type { Task } from "./task.js";
import type { OnboardingGuide } from "./guidance.js";

/** Body of POST /cases/:id/tasks/:taskId/status */
export const TaskStatusUpdate = z.object({ status: Status });
export type TaskStatusUpdate = z.infer<typeof TaskStatusUpdate>;

/** Lifecycle of one onboarding case */
export const CaseState = z.enum([
  "running",
  "completed",
  "needs_input",
  "stopped",
  "failed",
]);
export type CaseState = z.infer<typeof CaseState>;

// ---------- Response types: the contract between server and client ----------

export type BlockerKind =
  | "waiting_on_dependency"
  | "employee_only_conflict"
  | "at_risk_for_start_date";
export type Blocker = { taskId: string; kind: BlockerKind; message: string };

export type StatusSummary = {
  totalTasks: number;
  byStatus: Record<Status, number>;
  blockedTasks: number;
  conflicts: number;
  readyToStart: boolean;
};

/** One tool call the orchestrator made */
export type Step = {
  turn: number;
  tool: string;
  input: unknown;
  result: unknown;
  blockedByGuard: boolean;
  ms: number;
};

export type TraceEvent =
  | {
      kind: "orchestrator_turn";
      at: string;
      caseId: string;
      turn: number;
      model: string;
      ms: number;
      inputTokens: number;
      outputTokens: number;
      stopReason: string | null;
      toolsRequested: string[];
    }
  | {
      kind: "agent_call";
      at: string;
      caseId: string;
      agent: string;
      model: string;
      ms: number;
      inputTokens: number;
      outputTokens: number;
      attempts: number;
      ok: boolean;
      failureReason?: string;
    }
  | {
      kind: "tool_step";
      at: string;
      caseId: string;
      turn: number;
      tool: string;
      ms: number;
      refused: boolean;
    };

export type TraceSummary = {
  totalTokens: number;
  orchestrator: { tokens: number; ms: number; turns: number };
  agents: Record<
    string,
    {
      calls: number;
      ms: number;
      tokens: number;
      attempts: number;
      failures: number;
    }
  >;
  refusedToolCalls: number;
};

/** What is stored for one case */
export type CaseRecord = {
  id: string;
  intake: OnboardingIntake;
  state: CaseState;
  createdAt: string;
  finishedAt?: string;
  message?: string; // summary, question, or why it stopped/failed
  steps: Step[]; // grows while the orchestrator runs
  guide?: OnboardingGuide;
  usage?: { inputTokens: number; outputTokens: number; turns: number };
  trace: TraceEvent[]; // every turn, agent call and tool step, with timing and tokens
};

/** GET /cases/:id */
export type CaseView = CaseRecord & {
  tasks: Task[];
  blockers: Blocker[];
  status: StatusSummary;
};

/** GET /cases */
export type CaseListItem = {
  id: string;
  fullName: string;
  projectId: ProjectId;
  state: CaseState;
  createdAt: string;
};

/** GET /cases/:id/trace */
export type TraceResponse = {
  caseId: string;
  state: CaseState;
  summary: TraceSummary;
  events: TraceEvent[];
};

/** Any error response */
export type ApiError = { error: string; details?: string };
