import type { OrchestratorState, ToolName } from "./tools.js";

export const LIMITS = {
  maxTurns: 10,
  maxTokens: 60_000,
  maxCallsPerAgent: 2,
};

/**
 * Returns null if the tool may run now, or a message explaining why not.
 * The message goes back to the model as the tool result, so it can correct course.
 */
export function checkTool(
  name: ToolName,
  state: OrchestratorState,
): string | null {
  const calls = state.callCounts[name] ?? 0;
  const isAgent =
    name === "run_role_analysis" ||
    name === "run_access_planning" ||
    name === "run_guidance";
  if (isAgent && calls >= LIMITS.maxCallsPerAgent) {
    return `${name} has already been called ${calls} times, which is the limit. Continue with what you have.`;
  }

  switch (name) {
    case "run_access_planning":
    case "run_guidance":
      return state.role?.ok
        ? null
        : "Requires a successful role analysis first. Call run_role_analysis.";
    case "build_and_check_plan":
      if (!state.role) return "Run the role analysis before building the plan.";
      if (state.role.ok && !state.access)
        return "Run access planning before building the plan.";
      return null;
    case "finish":
      if (!state.plan) return "Build and check the plan before finishing.";
      if (state.role?.ok && !state.guide)
        return "Run guidance before finishing.";
      return null;
    default:
      return null;
  }
}
