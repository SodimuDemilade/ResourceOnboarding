import type { ContractType, Task } from "@onboarding/shared";
import { getCatalogueItem } from "../data/accessCatalogue.js";
import type { Blocker } from "@onboarding/shared";
export type { Blocker, BlockerKind } from "@onboarding/shared";

export type BlockerContext = {
  contractType: ContractType;
  startDate: string; // ISO date, e.g. "2026-11-23"
  today: string; // ISO date, passed in so tests control time
};

const AT_RISK_DAYS = 2;
const MUST_FINISH_BEFORE_START = ["compliance", "provisioning"];

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function findBlockers(
  tasks: Task[],
  context: BlockerContext,
): Blocker[] {
  const blockers: Blocker[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t])); // look up a dependency by id
  const daysToStart = daysBetween(context.today, context.startDate);

  for (const task of tasks) {
    if (task.status === "done" || task.status === "rejected") {
      continue;
    }

    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (dep && dep.status !== "done") {
        const message = `Waiting for '${dep.title}'`;
        blockers.push({
          taskId: task.id,
          kind: "waiting_on_dependency",
          message,
        });
      }
    }

    if (context.contractType === "contractor" && task.catalogueId) {
      const item = getCatalogueItem(task.catalogueId);
      if (item?.employeeOnly) {
        blockers.push({
          taskId: task.id,
          kind: "employee_only_conflict",
          message: `"${item.name}" is employee-only, but this joiner is a contractor`,
        });
      }
    }

    if (
      MUST_FINISH_BEFORE_START.includes(task.stage) &&
      daysToStart <= AT_RISK_DAYS
    ) {
      const message =
        daysToStart < 0
          ? "Not done, and the start date has passed"
          : daysToStart === 0
            ? "Not done, and the joiner starts today"
            : `Not done, ${daysToStart} day(s) before the start date`;
      blockers.push({
        taskId: task.id,
        kind: "at_risk_for_start_date",
        message,
      });
    }
  }

  return blockers;
}
