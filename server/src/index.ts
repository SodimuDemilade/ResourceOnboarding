import { config } from "./config.js";
import { createApp } from "./app.js";
import { createCaseService } from "./services/caseService.js";
import { InMemoryCaseStore, type CaseStore } from "./services/caseStore.js";
import { InMemoryTaskTracker } from "./services/inMemoryTaskTracker.js";
import type { TaskTracker } from "./services/taskTracker.js";
import { PostgresCaseStore } from "./services/postgresCaseStore.js";
import { PostgresTaskTracker } from "./services/postgresTaskTracker.js";
import { createPool, migrate } from "./db/pool.js";

let cases: CaseStore;
let tracker: TaskTracker;
let shutdown = async () => {};

if (config.databaseUrl) {
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  cases = new PostgresCaseStore(pool);
  tracker = new PostgresTaskTracker(pool);
  shutdown = () => pool.end();
  console.log("Storage: Postgres");
} else {
  cases = new InMemoryCaseStore();
  tracker = new InMemoryTaskTracker();
  console.log("Storage: in memory (set DATABASE_URL to use Postgres)");
}

const port = Number(process.env.PORT ?? 3001);
const server = createApp(createCaseService({ cases, tracker })).listen(
  port,
  () => {
    console.log(`Onboarding API listening on http://localhost:${port}`);
  },
);

// Close database connections cleanly on Ctrl+C
process.on("SIGINT", () => {
  server.close();
  void shutdown().then(() => process.exit(0));
});
