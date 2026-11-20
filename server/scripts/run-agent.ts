// Usage (from server/):
//   npx tsx scripts/run-agent.ts <role|access|guide|all> <projectId> <roleId> <seniority>
//   role   = Role & Project Analyst only
//   access = Analyst, then Access & Tools
//   guide  = Analyst, then Onboarding Guidance
//   all    = Analyst, then Access and Guidance IN PARALLEL
import { ProjectId, RoleId, Seniority } from "@onboarding/shared";
import type { StructuredResult } from "../src/llm/structured.js";
import { runRoleAnalyst } from "../src/agents/roleAnalyst/agent.js";
import { runAccessTools } from "../src/agents/accessTools/agent.js";
import { runGuidance } from "../src/agents/guidance/agent.js";

const commands = ["role", "access", "guide", "all"];
const [command, projectArg, roleArg, seniorityArg] = process.argv.slice(2);
if (!command || !commands.includes(command)) {
  console.error(
    "Usage: npx tsx scripts/run-agent.ts <role|access|guide|all> <projectId> <roleId> <seniority>",
  );
  process.exit(1);
}

const projectId = ProjectId.parse(projectArg);
const roleId = RoleId.parse(roleArg);
const seniority = Seniority.parse(seniorityArg);

function report(
  name: string,
  result: StructuredResult<unknown>,
  seconds: number,
) {
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `${seconds.toFixed(1)}s · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out · ${result.attempts} attempt(s)`,
  );
}

// Runs an async function and measures how long it took
async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; seconds: number }> {
  const started = Date.now();
  const value = await fn();
  return { value, seconds: (Date.now() - started) / 1000 };
}

const totalStart = Date.now();

// Step 1 (sequential): everything else depends on the role profile
const role = await timed(() =>
  runRoleAnalyst({ projectId, roleId, seniority }),
);
report("Role & Project Analyst", role.value, role.seconds);
if (command === "role") process.exit(0);
if (!role.value.ok) {
  console.error("\nRole analysis failed, so the other agents cannot run.");
  process.exit(1);
}
const roleProfile = role.value.data;

// Step 2 (parallel): Access and Guidance both need only the role profile
const [access, guide] = await Promise.all([
  command === "guide"
    ? null
    : timed(() => runAccessTools({ projectId, roleId, roleProfile })),
  command === "access"
    ? null
    : timed(() =>
        runGuidance({
          projectId,
          roleId,
          fullName: "Test Joiner",
          seniority,
          roleProfile,
        }),
      ),
]);
if (access) report("Access & Tools", access.value, access.seconds);
if (guide) report("Onboarding Guidance", guide.value, guide.seconds);

console.log(
  `\nTotal wall-clock time: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`,
);
