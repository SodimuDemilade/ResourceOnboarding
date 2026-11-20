import { describe, expect, it } from "vitest";
import type { Task } from "@onboarding/shared";
import {
  findBlockers,
  type BlockerContext,
} from "../../src/services/blockerRules.js";

// Builds a valid task; each test overrides only the fields it cares about
function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    caseId: "case-1",
    title: `Task ${overrides.id}`,
    description: "Test task",
    stage: "orientation",
    owner: "coordinator",
    dependsOn: [],
    requiresApproval: false,
    status: "not_started",
    ...overrides,
  };
}

// An employee starting in 10 days: nothing time-related should fire by default
const base: BlockerContext = {
  contractType: "employee",
  startDate: "2026-11-30",
  today: "2026-11-20",
};

describe("waiting_on_dependency", () => {
  it("blocks a task whose dependency is not done, naming the dependency", () => {
    const tasks = [
      task({ id: "nda", title: "Sign client NDA", stage: "compliance" }),
      task({
        id: "vpn",
        stage: "provisioning",
        dependsOn: ["nda"],
        catalogueId: "atlas-client-vpn",
      }),
    ];
    const blockers = findBlockers(tasks, base).filter(
      (b) => b.taskId === "vpn",
    );
    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.kind).toBe("waiting_on_dependency");
    expect(blockers[0]?.message).toContain("Sign client NDA");
  });

  it("does not block once the dependency is done", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance", status: "done" }),
      task({
        id: "vpn",
        stage: "provisioning",
        dependsOn: ["nda"],
        catalogueId: "atlas-client-vpn",
      }),
    ];
    expect(findBlockers(tasks, base)).toEqual([]);
  });

  it("reports one blocker per unfinished dependency", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance" }),
      task({ id: "bg-check", stage: "compliance" }),
      task({
        id: "vpn",
        stage: "provisioning",
        dependsOn: ["nda", "bg-check"],
      }),
    ];
    expect(
      findBlockers(tasks, base).filter((b) => b.taskId === "vpn"),
    ).toHaveLength(2);
  });

  it("ignores tasks that are already done or rejected", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance" }),
      task({ id: "a", dependsOn: ["nda"], status: "done" }),
      task({ id: "b", dependsOn: ["nda"], status: "rejected" }),
    ];
    expect(findBlockers(tasks, base).filter((b) => b.taskId !== "nda")).toEqual(
      [],
    );
  });
});

describe("employee_only_conflict", () => {
  it("flags a contractor who needs an employee-only item", () => {
    const tasks = [
      task({
        id: "prod-db",
        stage: "provisioning",
        catalogueId: "atlas-prod-db-read",
      }),
    ];
    const blockers = findBlockers(tasks, {
      ...base,
      contractType: "contractor",
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.kind).toBe("employee_only_conflict");
    expect(blockers[0]?.message).toContain("Atlas production database");
  });

  it("does not flag an employee for the same item", () => {
    const tasks = [
      task({
        id: "prod-db",
        stage: "provisioning",
        catalogueId: "atlas-prod-db-read",
      }),
    ];
    expect(findBlockers(tasks, base)).toEqual([]);
  });

  it("does not flag a contractor for an item that is not employee-only", () => {
    const tasks = [
      task({
        id: "gitlab",
        stage: "provisioning",
        catalogueId: "atlas-gitlab",
      }),
    ];
    expect(
      findBlockers(tasks, { ...base, contractType: "contractor" }),
    ).toEqual([]);
  });
});

describe("at_risk_for_start_date", () => {
  const twoDaysOut: BlockerContext = { ...base, today: "2026-11-28" }; // start 2026-11-30

  it("flags unfinished compliance and provisioning tasks within 2 days of the start date", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance" }),
      task({ id: "laptop", stage: "provisioning", owner: "it" }),
    ];
    const blockers = findBlockers(tasks, twoDaysOut);
    expect(blockers.map((b) => b.kind)).toEqual([
      "at_risk_for_start_date",
      "at_risk_for_start_date",
    ]);
  });

  it("does not flag tasks more than 2 days before the start date", () => {
    expect(
      findBlockers([task({ id: "nda", stage: "compliance" })], {
        ...base,
        today: "2026-11-27",
      }),
    ).toEqual([]);
  });

  it("does not flag finished tasks or other stages", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance", status: "done" }),
      task({ id: "buddy", stage: "orientation" }),
    ];
    expect(findBlockers(tasks, twoDaysOut)).toEqual([]);
  });

  it("still flags tasks after the start date has passed", () => {
    const blockers = findBlockers([task({ id: "nda", stage: "compliance" })], {
      ...base,
      today: "2026-12-02",
    });
    expect(blockers[0]?.kind).toBe("at_risk_for_start_date");
  });
});

describe("combined", () => {
  it("reports every blocker on a task, not just the first", () => {
    const tasks = [
      task({ id: "nda", stage: "compliance", status: "done" }),
      task({ id: "bg-check", stage: "compliance", status: "done" }),
      task({
        id: "prod-db",
        stage: "provisioning",
        dependsOn: ["nda"],
        catalogueId: "atlas-prod-db-read",
      }),
    ];
    const kinds = findBlockers(tasks, {
      contractType: "contractor",
      startDate: "2026-11-30",
      today: "2026-11-29",
    }).map((b) => b.kind);
    expect(kinds).toContain("employee_only_conflict");
    expect(kinds).toContain("at_risk_for_start_date");
    expect(kinds).not.toContain("waiting_on_dependency");
  });
});
