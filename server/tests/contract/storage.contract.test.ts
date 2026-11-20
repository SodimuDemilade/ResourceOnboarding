// The SAME tests run against every implementation of TaskTracker and CaseStore.
// In-memory always runs; Postgres runs only when TEST_DATABASE_URL is set.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { CaseRecord, Step, Task } from "@onboarding/shared";
import type { TaskTracker } from "../../src/services/taskTracker.js";
import type { CaseStore } from "../../src/services/caseStore.js";
import { InMemoryTaskTracker } from "../../src/services/inMemoryTaskTracker.js";
import { InMemoryCaseStore } from "../../src/services/caseStore.js";
import { PostgresTaskTracker } from "../../src/services/postgresTaskTracker.js";
import { PostgresCaseStore } from "../../src/services/postgresCaseStore.js";
import { createPool, migrate } from "../../src/db/pool.js";

const dbUrl = process.env.TEST_DATABASE_URL;
const pool = dbUrl ? createPool(dbUrl) : undefined;

beforeAll(async () => {
  if (pool) await migrate(pool);
});
afterAll(async () => {
  await pool?.end();
});

const implementations = [
  {
    name: "in-memory",
    enabled: true,
    make: () => ({
      cases: new InMemoryCaseStore() as CaseStore,
      tracker: new InMemoryTaskTracker() as TaskTracker,
    }),
  },
  {
    name: "postgres",
    enabled: Boolean(pool),
    make: () => ({
      cases: new PostgresCaseStore(pool!) as CaseStore,
      tracker: new PostgresTaskTracker(pool!) as TaskTracker,
    }),
  },
];

const newCase = (): CaseRecord => ({
  id: randomUUID(),
  intake: {
    fullName: "Sam Okoro",
    roleId: "backend-dev",
    projectId: "atlas",
    seniority: "senior",
    startDate: "2026-11-30",
    contractType: "contractor",
    location: "New York",
  },
  state: "running",
  createdAt: new Date().toISOString(),
  steps: [],
  trace: [],
});

const task = (caseId: string, id: string, extra: Partial<Task> = {}): Task => ({
  id,
  caseId,
  title: `Task ${id}`,
  description: "d",
  stage: "provisioning",
  owner: "it",
  dependsOn: [],
  requiresApproval: false,
  status: "not_started",
  ...extra,
});

for (const impl of implementations) {
  describe.skipIf(!impl.enabled)(`storage contract: ${impl.name}`, () => {
    let cases: CaseStore;
    let tracker: TaskTracker;
    let record: CaseRecord;

    beforeEach(async () => {
      ({ cases, tracker } = impl.make());
      record = newCase();
      await cases.create(record);
    });

    it("stores and returns a case exactly as given", async () => {
      expect(await cases.get(record.id)).toEqual(record);
    });

    it("returns undefined for an unknown case", async () => {
      expect(await cases.get(randomUUID())).toBeUndefined();
    });

    it("updates only the fields given", async () => {
      await cases.update(record.id, {
        state: "completed",
        message: "Plan ready",
      });
      const got = await cases.get(record.id);
      expect(got).toMatchObject({
        state: "completed",
        message: "Plan ready",
        intake: record.intake,
      });
    });

    it("keeps every step when steps are added at the same moment", async () => {
      const step = (n: number): Step => ({
        turn: 1,
        tool: `tool_${n}`,
        input: {},
        result: {},
        blockedByGuard: false,
        ms: n,
      });
      await Promise.all(
        [1, 2, 3, 4, 5].map((n) => cases.addStep(record.id, step(n))),
      );
      expect((await cases.get(record.id))?.steps).toHaveLength(5);
    });

    it("saves tasks in order, with optional fields round-tripping", async () => {
      const tasks = [
        task(record.id, "nda", { stage: "compliance" }),
        task(record.id, "vpn", {
          dependsOn: ["nda"],
          catalogueId: "atlas-client-vpn",
        }),
      ];
      await tracker.saveTasks(record.id, tasks);
      expect(await tracker.getTasks(record.id)).toEqual(tasks);
    });

    it("replaces the task list on a second save", async () => {
      await tracker.saveTasks(record.id, [
        task(record.id, "a"),
        task(record.id, "b"),
      ]);
      await tracker.saveTasks(record.id, [task(record.id, "c")]);
      expect((await tracker.getTasks(record.id)).map((t) => t.id)).toEqual([
        "c",
      ]);
    });

    it("rejects a dependency on an unknown task and saves nothing", async () => {
      await expect(
        tracker.saveTasks(record.id, [
          task(record.id, "vpn", { dependsOn: ["missing"] }),
        ]),
      ).rejects.toThrow(/unknown task/);
      expect(await tracker.getTasks(record.id)).toEqual([]);
    });

    it("updates a task's status and returns the updated task", async () => {
      await tracker.saveTasks(record.id, [task(record.id, "nda")]);
      expect(
        (await tracker.updateStatus(record.id, "nda", "done")).status,
      ).toBe("done");
      expect((await tracker.getTasks(record.id))[0]?.status).toBe("done");
    });

    it("throws when updating a task that does not exist", async () => {
      await expect(
        tracker.updateStatus(record.id, "nope", "done"),
      ).rejects.toThrow(/No task/);
    });
  });
}
