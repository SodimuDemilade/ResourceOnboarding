import type { Status, Task, StatusSummary } from "@onboarding/shared";
import type { Blocker } from "./blockerRules.js";
export type { StatusSummary } from "@onboarding/shared";

export function summarise(tasks: Task[], blockers: Blocker[]): StatusSummary {
  const byStatus: Record<Status, number> = {
    not_started: 0,
    in_progress: 0,
    awaiting_approval: 0,
    done: 0,
    rejected: 0,
  };
  for (const task of tasks) byStatus[task.status] += 1;

  const mustBeDone = tasks.filter(
    (t) => t.stage === "compliance" || t.stage === "provisioning",
  );
  return {
    totalTasks: tasks.length,
    byStatus,
    blockedTasks: new Set(blockers.map((b) => b.taskId)).size,
    conflicts: blockers.filter((b) => b.kind === "employee_only_conflict")
      .length,
    readyToStart:
      blockers.length === 0 &&
      mustBeDone.every((t) => t.status === "done" || t.status === "rejected"),
  };
}
