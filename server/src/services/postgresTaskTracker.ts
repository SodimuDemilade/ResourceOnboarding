import type pg from "pg";
import type { Status, Task } from "@onboarding/shared";
import { assertDependenciesExist, type TaskTracker } from "./taskTracker.js";

type TaskRow = {
  case_id: string;
  id: string;
  title: string;
  description: string;
  stage: Task["stage"];
  owner: Task["owner"];
  depends_on: string[];
  requires_approval: boolean;
  status: Status;
  catalogue_id: string | null;
};

/** Database row (snake_case, nulls) → Task (camelCase, optional fields left out). */
function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    caseId: row.case_id,
    title: row.title,
    description: row.description,
    stage: row.stage,
    owner: row.owner,
    dependsOn: row.depends_on,
    requiresApproval: row.requires_approval,
    status: row.status,
    ...(row.catalogue_id ? { catalogueId: row.catalogue_id } : {}),
  };
}

export class PostgresTaskTracker implements TaskTracker {
  constructor(private pool: pg.Pool) {}

  async saveTasks(caseId: string, tasks: Task[]): Promise<void> {
    assertDependenciesExist(tasks);

    // Replace the whole list atomically: either every task is saved, or none is
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM tasks WHERE case_id = $1", [caseId]);
      for (const [position, t] of tasks.entries()) {
        await client.query(
          `INSERT INTO tasks (case_id, id, position, title, description, stage, owner, depends_on, requires_approval, status, catalogue_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            caseId,
            t.id,
            position,
            t.title,
            t.description,
            t.stage,
            t.owner,
            t.dependsOn,
            t.requiresApproval,
            t.status,
            t.catalogueId ?? null,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release(); // always give the connection back to the pool
    }
  }

  async getTasks(caseId: string): Promise<Task[]> {
    const { rows } = await this.pool.query<TaskRow>(
      "SELECT * FROM tasks WHERE case_id = $1 ORDER BY position",
      [caseId],
    );
    return rows.map(toTask);
  }

  async updateStatus(
    caseId: string,
    taskId: string,
    status: Status,
  ): Promise<Task> {
    const { rows } = await this.pool.query<TaskRow>(
      "UPDATE tasks SET status = $3 WHERE case_id = $1 AND id = $2 RETURNING *",
      [caseId, taskId, status],
    );
    const row = rows[0];
    if (!row) throw new Error(`No task "${taskId}" in case "${caseId}"`);
    return toTask(row);
  }
}
