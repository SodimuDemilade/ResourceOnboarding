import type { Status, Task } from "@onboarding/shared";

/**
 * Where onboarding tasks are stored. The rest of the system only uses this interface,
 * so the storage can change (in-memory → Postgres → Jira) without touching anything else.
 */
export interface TaskTracker {
  saveTasks(caseId: string, tasks: Task[]): Promise<void>;
  getTasks(caseId: string): Promise<Task[]>;
  updateStatus(caseId: string, taskId: string, status: Status): Promise<Task>;
}

/** Relationship check shared by every implementation: each dependency must be a task in the same list. */
export function assertDependenciesExist(tasks: Task[]): void {
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep))
        throw new Error(`Task "${task.id}" depends on unknown task "${dep}"`);
    }
  }
}
