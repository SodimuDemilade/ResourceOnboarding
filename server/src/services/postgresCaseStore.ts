import type pg from "pg";
import type { CaseRecord, Step, TraceEvent } from "@onboarding/shared";
import type { CaseStore } from "./caseStore.js";

type CaseRow = {
  id: string;
  intake: CaseRecord["intake"];
  state: CaseRecord["state"];
  created_at: Date;
  finished_at: Date | null;
  message: string | null;
  steps: Step[];
  trace: TraceEvent[];
  guide: CaseRecord["guide"] | null;
  usage: CaseRecord["usage"] | null;
};

function toRecord(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    intake: row.intake,
    state: row.state,
    createdAt: row.created_at.toISOString(),
    steps: row.steps,
    trace: row.trace,
    ...(row.finished_at ? { finishedAt: row.finished_at.toISOString() } : {}),
    ...(row.message !== null ? { message: row.message } : {}),
    ...(row.guide ? { guide: row.guide } : {}),
    ...(row.usage ? { usage: row.usage } : {}),
  };
}

// Which record fields update() may change, and the column each maps to.
// Column names come ONLY from this list, never from input, so they cannot be used for SQL injection.
const COLUMNS = {
  intake: { column: "intake", json: true },
  state: { column: "state", json: false },
  createdAt: { column: "created_at", json: false },
  finishedAt: { column: "finished_at", json: false },
  message: { column: "message", json: false },
  steps: { column: "steps", json: true },
  trace: { column: "trace", json: true },
  guide: { column: "guide", json: true },
  usage: { column: "usage", json: true },
} as const;

export class PostgresCaseStore implements CaseStore {
  constructor(private pool: pg.Pool) {}

  async create(r: CaseRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO cases (id, intake, state, created_at, finished_at, message, steps, trace, guide, usage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.id,
        JSON.stringify(r.intake),
        r.state,
        r.createdAt,
        r.finishedAt ?? null,
        r.message ?? null,
        JSON.stringify(r.steps),
        JSON.stringify(r.trace),
        r.guide ? JSON.stringify(r.guide) : null,
        r.usage ? JSON.stringify(r.usage) : null,
      ],
    );
  }

  async get(id: string): Promise<CaseRecord | undefined> {
    const { rows } = await this.pool.query<CaseRow>(
      "SELECT * FROM cases WHERE id = $1",
      [id],
    );
    return rows[0] ? toRecord(rows[0]) : undefined;
  }

  async update(
    id: string,
    changes: Partial<Omit<CaseRecord, "id">>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const [key, value] of Object.entries(changes)) {
      const target = COLUMNS[key as keyof typeof COLUMNS];
      if (!target) continue;
      values.push(target.json ? JSON.stringify(value) : value);
      sets.push(`${target.column} = $${values.length}`);
    }
    if (sets.length === 0) return;
    const result = await this.pool.query(
      `UPDATE cases SET ${sets.join(", ")} WHERE id = $1`,
      values,
    );
    if (result.rowCount === 0) throw new Error(`No case "${id}"`);
  }

  // Append inside the database (steps || new item), so two steps saved at the same
  // moment (parallel tool calls) can never overwrite each other.
  async addStep(id: string, step: Step): Promise<void> {
    await this.pool.query(
      "UPDATE cases SET steps = steps || $2::jsonb WHERE id = $1",
      [id, JSON.stringify([step])],
    );
  }

  async addTraceEvent(id: string, event: TraceEvent): Promise<void> {
    await this.pool.query(
      "UPDATE cases SET trace = trace || $2::jsonb WHERE id = $1",
      [id, JSON.stringify([event])],
    );
  }

  async list(): Promise<CaseRecord[]> {
    const { rows } = await this.pool.query<CaseRow>(
      "SELECT * FROM cases ORDER BY created_at DESC",
    );
    return rows.map(toRecord);
  }
}
