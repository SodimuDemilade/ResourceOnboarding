import type { TraceEvent, TraceSummary } from "@onboarding/shared";
export type { TraceEvent } from "@onboarding/shared";

// The caller supplies everything except the timestamp and case id, which the tracer adds.
// (Distributive Omit: applied to each member of the union separately.)
type WithoutCommon<T> = T extends unknown ? Omit<T, "at" | "caseId"> : never;
export type TraceInput = WithoutCommon<TraceEvent>;

export type Tracer = { record(event: TraceInput): void };

/** Records events for one case: writes each as a JSON log line and hands it to onEvent (e.g. the case store). */
export function createTracer(
  caseId: string,
  onEvent?: (event: TraceEvent) => void,
): Tracer {
  return {
    record(input) {
      const event = {
        at: new Date().toISOString(),
        caseId,
        ...input,
      } as TraceEvent;
      console.log(JSON.stringify(event)); // structured log: one JSON object per line
      onEvent?.(event);
    },
  };
}

/** Totals for the trace view: where did the time and tokens go? */
export function summariseTrace(events: TraceEvent[]): TraceSummary {
  const byAgent: TraceSummary["agents"] = {};
  let orchestratorTokens = 0;
  let orchestratorMs = 0;
  let refusedToolCalls = 0;

  for (const e of events) {
    if (e.kind === "orchestrator_turn") {
      orchestratorTokens += e.inputTokens + e.outputTokens;
      orchestratorMs += e.ms;
    } else if (e.kind === "agent_call") {
      const a = (byAgent[e.agent] ??= {
        calls: 0,
        ms: 0,
        tokens: 0,
        attempts: 0,
        failures: 0,
      });
      a.calls += 1;
      a.ms += e.ms;
      a.tokens += e.inputTokens + e.outputTokens;
      a.attempts += e.attempts;
      if (!e.ok) a.failures += 1;
    } else if (e.refused) {
      refusedToolCalls += 1;
    }
  }

  const agentTokens = Object.values(byAgent).reduce(
    (sum, a) => sum + a.tokens,
    0,
  );
  return {
    totalTokens: orchestratorTokens + agentTokens,
    orchestrator: {
      tokens: orchestratorTokens,
      ms: orchestratorMs,
      turns: events.filter((e) => e.kind === "orchestrator_turn").length,
    },
    agents: byAgent,
    refusedToolCalls,
  };
}
