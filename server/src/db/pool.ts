import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/** One pool per process: it keeps a few connections open and lends them out per query. */
export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 5 });
}

/** Creates the tables if they do not exist yet. */
export async function migrate(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(join(import.meta.dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

// Opening a database connection is slow, especially to a cloud database. A pool keeps a few connections open and reuses them.
