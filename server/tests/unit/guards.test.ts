import { describe, expect, it } from "vitest";
import type { RoleProfile } from "@onboarding/shared";
import { checkTool } from "../../src/orchestrator/guards.js";
import type { OrchestratorState } from "../../src/orchestrator/tools.js";
import type { StructuredResult } from "../../src/llm/structured.js";

const usage = { inputTokens: 0, outputTokens: 0 };
const roleOk: StructuredResult<RoleProfile> = {
  ok: true,
  attempts: 1,
  usage,
  data: {
    techStack: [],
    responsibilities: [{ description: "Build screens.", source: "brief" }],
    keyContacts: [],
    missingInformation: [],
  },
};
const roleFailed: StructuredResult<RoleProfile> = {
  ok: false,
  reason: "invalid_output",
  detail: "test",
  attempts: 2,
  usage,
};
const fresh = (): OrchestratorState => ({ callCounts: {} });

describe("dependency guards", () => {
  it("refuses guidance before any role analysis", () => {
    expect(checkTool("run_guidance", fresh())).toMatch(/role analysis/i);
  });

  it("refuses guidance after a FAILED role analysis", () => {
    expect(
      checkTool("run_guidance", { ...fresh(), role: roleFailed }),
    ).not.toBeNull();
  });

  it("allows guidance after a successful role analysis", () => {
    expect(checkTool("run_guidance", { ...fresh(), role: roleOk })).toBeNull();
  });
});

describe("call limits", () => {
  it("allows a second role analysis (one retry)", () => {
    expect(
      checkTool("run_role_analysis", { callCounts: { run_role_analysis: 1 } }),
    ).toBeNull();
  });

  it("refuses a third role analysis", () => {
    expect(
      checkTool("run_role_analysis", { callCounts: { run_role_analysis: 2 } }),
    ).toMatch(/limit/i);
  });
});

describe("finish", () => {
  const plan = {
    tasks: [],
    blockers: [],
    status: {
      totalTasks: 0,
      byStatus: {
        not_started: 0,
        in_progress: 0,
        awaiting_approval: 0,
        done: 0,
        rejected: 0,
      },
      blockedTasks: 0,
      conflicts: 0,
      readyToStart: false,
    },
  };
  const guide = {
    ok: false as const,
    reason: "truncated" as const,
    detail: "test",
    attempts: 1,
    usage,
  };

  it("refuses finish before the plan is built", () => {
    expect(checkTool("finish", { ...fresh(), role: roleOk, guide })).toMatch(
      /plan/i,
    );
  });

  it("refuses finish when guidance was never attempted", () => {
    expect(checkTool("finish", { ...fresh(), role: roleOk, plan })).toMatch(
      /guidance/i,
    );
  });

  it("allows finish when guidance was attempted, even if it failed", () => {
    expect(
      checkTool("finish", { ...fresh(), role: roleOk, plan, guide }),
    ).toBeNull();
  });
});
