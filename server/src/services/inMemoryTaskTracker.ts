import type { Status, Task } from "@onboarding/shared";
import { assertDependenciesExist, type TaskTracker } from "./taskTracker.js";

export class InMemoryTaskTracker implements TaskTracker {
  private tasksByCase = new Map<string, Task[]>();

  async saveTasks(caseId: string, tasks: Task[]): Promise<void> {
    assertDependenciesExist(tasks);
    this.tasksByCase.set(caseId, structuredClone(tasks));
  }

  async getTasks(caseId: string): Promise<Task[]> {
    return structuredClone(this.tasksByCase.get(caseId) ?? []);
  }

  async updateStatus(
    caseId: string,
    taskId: string,
    status: Status,
  ): Promise<Task> {
    const task = this.tasksByCase.get(caseId)?.find((t) => t.id === taskId);
    if (!task) throw new Error(`No task "${taskId}" in case "${caseId}"`);
    task.status = status;
    return structuredClone(task);
  }
}
