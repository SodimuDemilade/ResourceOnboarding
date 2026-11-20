import type { CaseState, Step } from "@onboarding/shared";

const LABELS: Record<string, string> = {
  run_role_analysis: "Role & Project Analyst",
  run_access_planning: "Access & Tools",
  run_guidance: "Onboarding Guidance",
  build_and_check_plan: "Build plan and check rules",
  ask_coordinator: "Question for the coordinator",
  finish: "Summary written",
};

/** Live view of the orchestrator's decisions, grouped by turn. */
export function StepTimeline({ steps, state }: { steps: Step[]; state: CaseState }) {
  const turns = [...new Set(steps.map((s) => s.turn))];

  return (
    <ol className="timeline">
      {turns.map((turn) => {
        const inTurn = steps.filter((s) => s.turn === turn);
        return (
          <li key={turn}>
            <span className="eyebrow">Turn {turn}{inTurn.length > 1 ? " · in parallel" : ""}</span>
            {inTurn.map((s, i) => (
              <div key={i} className={s.blockedByGuard ? "step refused" : "step"}>
                {s.blockedByGuard ? <span aria-hidden="true">⛔</span> : <CheckIcon />}
                <span className="step-name">{LABELS[s.tool] ?? s.tool}</span>
                <span className="muted num">{(s.ms / 1000).toFixed(1)}s</span>
                {s.blockedByGuard && <div className="reason">Refused by guard: {(s.result as { error?: string }).error}</div>}
              </div>
            ))}
          </li>
        );
      })}
      {state === "running" && <li className="working">Orchestrator is working…</li>}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A7F37" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
