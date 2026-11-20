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

export type OnboardingRun = {
  caseId: string;
  agents: {
    role: StructuredResult<RoleProfile>;
    access: StructuredResult<AccessRecommendation> | null;
    guide: StructuredResult<OnboardingGuide> | null;
  };
  tasks: Task[];
  blockers: Blocker[];
  status: StatusSummary;
  failures: string[]; // what went wrong, in plain words, for the coordinator
};

/**
 * Version 1 orchestration: the ORDER is fixed in code.
 * Agents provide judgment; code builds tasks, applies rules and stores state.
 */
export async function runOnboarding(args: {
  caseId: string;
  intake: OnboardingIntake;
  tracker: TaskTracker;
  today: string;
}): Promise<OnboardingRun> {
  const { caseId, intake, tracker, today } = args;
  const { projectId, roleId, seniority } = intake;
  const failures: string[] = [];

  // 1. Sequential: everything depends on the role profile
  const role = await runRoleAnalyst({ projectId, roleId, seniority });

  // 2. Parallel: Access and Guidance both need only the role profile
  let access: StructuredResult<AccessRecommendation> | null = null;
  let guide: StructuredResult<OnboardingGuide> | null = null;
  if (role.ok) {
    [access, guide] = await Promise.all([
      runAccessTools({ projectId, roleId, roleProfile: role.data }),
      runGuidance({
        projectId,
        roleId,
        fullName: intake.fullName,
        seniority,
        roleProfile: role.data,
      }),
    ]);
  } else {
    failures.push(
      `Role analysis failed (${role.reason}), so access and guidance could not be planned. Only standard tasks were created.`,
    );
  }
  if (access && !access.ok)
    failures.push(
      `Access planning failed (${access.reason}). Only standard access was added; project access needs a manual review.`,
    );
  if (guide && !guide.ok)
    failures.push(
      `The onboarding guide could not be written (${guide.reason}).`,
    );

  // 3. Code: build tasks from facts + agent output, store them, apply rules
  const tasks = buildTasks({
    caseId,
    intake,
    project: getProject(projectId),
    access: access?.ok ? access.data : null,
  });
  await tracker.saveTasks(caseId, tasks);
  const stored = await tracker.getTasks(caseId);
  const blockers = findBlockers(stored, {
    contractType: intake.contractType,
    startDate: intake.startDate,
    today,
  });

  return {
    caseId,
    agents: { role, access, guide },
    tasks: stored,
    blockers,
    status: summarise(stored, blockers),
    failures,
  };
}
