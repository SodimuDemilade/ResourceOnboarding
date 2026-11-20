import { describe, expect, it } from "vitest";
import type {
  AccessRecommendation,
  OnboardingIntake,
} from "@onboarding/shared";
import { buildTasks } from "../../src/orchestrator/buildTasks.js";
import { getProject } from "../../src/data/projectRespository.js";

const intake: OnboardingIntake = {
  fullName: "Priya Shah",
  roleId: "backend-dev",
  projectId: "atlas",
  seniority: "senior",
  startDate: "2026-11-30",
  contractType: "contractor",
  location: "New York",
};
const picks = (...ids: string[]): AccessRecommendation => ({
  items: ids.map((catalogueId) => ({
    catalogueId,
    justification: `Needed: ${catalogueId}`,
  })),
  missingInformation: [],
});
const atlas = getProject("atlas");
const nova = getProject("nova");
const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

describe("compliance tasks", () => {
  it("adds NDA and background check when the project requires them", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: null,
    });
    expect(ids(tasks)).toContain("nda");
    expect(ids(tasks)).toContain("background-check");
  });

  it("leaves them out when the project does not require them", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake: { ...intake, projectId: "nova" },
      project: nova,
      access: null,
    });
    expect(ids(tasks)).not.toContain("nda");
    expect(ids(tasks)).not.toContain("background-check");
    expect(ids(tasks)).toContain("trainings");
  });

  it("treats NDA and background check as actions, not approvals", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: null,
    });
    expect(tasks.find((t) => t.id === "nda")).toMatchObject({
      owner: "new_joiner",
      requiresApproval: false,
      status: "not_started",
    });
    expect(tasks.find((t) => t.id === "background-check")).toMatchObject({
      requiresApproval: false,
      status: "not_started",
    });
  });
});

describe("access tasks", () => {
  it("always adds the baseline items, even when the Access agent failed", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: null,
    });
    for (const id of ["corporate-email", "team-chat", "jira", "confluence"]) {
      expect(ids(tasks)).toContain(`access-${id}`);
    }
  });

  it("adds one task per picked item, using the agent's justification as description", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: picks("atlas-gitlab"),
    });
    const gitlab = tasks.find((t) => t.id === "access-atlas-gitlab");
    expect(gitlab?.catalogueId).toBe("atlas-gitlab");
    expect(gitlab?.description).toBe("Needed: atlas-gitlab");
  });

  it("ignores a duplicate pick", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: picks("atlas-gitlab", "atlas-gitlab"),
    });
    expect(tasks.filter((t) => t.id === "access-atlas-gitlab")).toHaveLength(1);
  });

  it("takes requiresApproval from the catalogue and starts approval items as awaiting_approval", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: picks("atlas-gitlab"),
    });
    const gitlab = tasks.find((t) => t.id === "access-atlas-gitlab");
    const email = tasks.find((t) => t.id === "access-corporate-email");
    expect(gitlab).toMatchObject({
      requiresApproval: true,
      status: "awaiting_approval",
      owner: "approver",
    });
    expect(email).toMatchObject({
      requiresApproval: false,
      status: "not_started",
      owner: "it",
    });
  });

  it("makes client-system access depend on the NDA and background check", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: picks("atlas-prod-db-read"),
    });
    expect(
      tasks.find((t) => t.id === "access-atlas-prod-db-read")?.dependsOn,
    ).toEqual(["nda", "background-check"]);
  });

  it("gives non-client access no dependencies", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: null,
    });
    expect(tasks.find((t) => t.id === "access-jira")?.dependsOn).toEqual([]);
  });
});

describe("every task", () => {
  it("belongs to the case and has a unique id", () => {
    const tasks = buildTasks({
      caseId: "c1",
      intake,
      project: atlas,
      access: picks("atlas-gitlab", "atlas-client-vpn"),
    });
    expect(tasks.every((t) => t.caseId === "c1")).toBe(true);
    expect(new Set(ids(tasks)).size).toBe(tasks.length);
  });
});
