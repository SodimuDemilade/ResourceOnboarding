// Usage (from server/):  npx tsx scripts/run-workflow.ts <happy|conflict|missing>
import { z } from "zod";
import { OnboardingIntake } from "@onboarding/shared";
import { runOnboarding } from "../src/orchestrator/workflow.js";
import { InMemoryTaskTracker } from "../src/services/inMemoryTaskTracker.js";

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
  missing: {
    fullName: "Lena Park",
    roleId: "qa",
    projectId: "orion",
    contractType: "employee",
    location: "New York",
  },
};

const name = process.argv[2] ?? "";
const scenario = scenarios[name];
if (!scenario) {
  console.error(
    `Usage: npx tsx scripts/run-workflow.ts <${Object.keys(scenarios).join("|")}>`,
  );
  process.exit(1);
}

// Missing information is caught BEFORE any agent runs, at no cost
const parsed = OnboardingIntake.safeParse(scenario);
if (!parsed.success) {
  console.log(
    "Intake is incomplete. Ask the coordinator for:\n" +
      z.prettifyError(parsed.error),
  );
  process.exit(0);
}

const started = Date.now();
const run = await runOnboarding({
  caseId: `case-${name}`,
  intake: parsed.data,
  tracker: new InMemoryTaskTracker(),
  today: new Date().toISOString().slice(0, 10),
});

console.log(`\n=== Tasks (${run.tasks.length}) ===`);
for (const t of run.tasks)
  console.log(
    `[${t.stage}] ${t.status.padEnd(17)} ${t.title}${t.dependsOn.length ? `  (after: ${t.dependsOn.join(", ")})` : ""}`,
  );
console.log(`\n=== Blockers (${run.blockers.length}) ===`);
for (const b of run.blockers)
  console.log(`${b.kind.padEnd(24)} ${b.taskId}: ${b.message}`);
console.log("\n=== Status ===");
console.log(JSON.stringify(run.status, null, 2));
if (run.failures.length)
  console.log("\n=== Failures ===\n" + run.failures.join("\n"));

const tokens = Object.values(run.agents).reduce(
  (sum, r) => sum + (r ? r.usage.inputTokens + r.usage.outputTokens : 0),
  0,
);
console.log(
  `\n${((Date.now() - started) / 1000).toFixed(1)}s · ${tokens} tokens across agents`,
);
