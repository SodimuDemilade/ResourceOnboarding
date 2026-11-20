// Usage (from server/):  npx tsx scripts/run-orchestrator.ts <happy|conflict|thin>
import { OnboardingIntake } from "@onboarding/shared";
import { runOrchestrator } from "../src/orchestrator/orchestrator.js";
import { InMemoryTaskTracker } from "../src/services/inMemoryTaskTracker.js";
import { createTracer } from "../src/tracing/tracer.js";

const scenarios: Record<string, unknown> = {
  happy: {
    fullName: "Priya Shah",
    roleId: "frontend-dev",
    projectId: "nova",
    seniority: "junior",
    startDate: "2026-11-30",
    contractType: "employee",
    location: "New York",
  },
  conflict: {
    fullName: "Sam Okoro",
    roleId: "backend-dev",
    projectId: "atlas",
    seniority: "senior",
    startDate: "2026-11-30",
    contractType: "contractor",
    location: "New York",
  },
  thin: {
    fullName: "Lena Park",
    roleId: "business-analyst",
    projectId: "orion",
    seniority: "mid",
    startDate: "2026-11-30",
    contractType: "employee",
    location: "New York",
  },
};

const name = process.argv[2] ?? "";
if (!scenarios[name]) {
  console.error(
    `Usage: npx tsx scripts/run-orchestrator.ts <${Object.keys(scenarios).join("|")}>`,
  );
  process.exit(1);
}
const intake = OnboardingIntake.parse(scenarios[name]);

const started = Date.now();
const run = await runOrchestrator({
  caseId: `case-${name}`,
  intake,
  tracker: new InMemoryTaskTracker(),
  today: new Date().toISOString().slice(0, 10),
  tracer: createTracer(`case-${name}`),
});

console.log("=== Steps the orchestrator chose ===");
for (const s of run.steps) {
  console.log(
    `turn ${s.turn}  ${s.tool.padEnd(22)} ${(s.ms / 1000).toFixed(1).padStart(5)}s  ${s.blockedByGuard ? "BLOCKED: " + JSON.stringify(s.result) : ""}`,
  );
}
console.log(`\n=== Outcome: ${run.outcome} ===\n${run.message}`);
if (run.state.plan)
  console.log(
    `\nPlan: ${run.state.plan.tasks.length} tasks, ${run.state.plan.blockers.length} blockers, ${run.state.plan.status.conflicts} conflict(s)`,
  );

const agentTokens = [run.state.role, run.state.access, run.state.guide].reduce(
  (sum, r) => sum + (r ? r.usage.inputTokens + r.usage.outputTokens : 0),
  0,
);
console.log(
  `\n${((Date.now() - started) / 1000).toFixed(1)}s · orchestrator ${run.usage.turns} turns, ${run.usage.inputTokens + run.usage.outputTokens} tokens · specialists ${agentTokens} tokens`,
);
