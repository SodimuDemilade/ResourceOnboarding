import { useEffect, useState } from "react";
import type { TraceEvent, TraceResponse } from "@onboarding/shared";
import { api } from "../api";

const AGENT_LABEL: Record<string, string> = {
  role_analyst: "Role & Project Analyst",
  access_tools: "Access & Tools",
  guidance: "Onboarding Guidance",
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function TracePanel({ id }: { id: string }) {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getTrace(id)
      .then((t) => { if (!cancelled) setTrace(t); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p className="alert-error">{error}</p>;
  if (!trace) return <p className="muted">Loading trace…</p>;

  const { summary, events } = trace;
  const agents = Object.entries(summary.agents);
  const agentCalls = events.filter((e): e is Extract<TraceEvent, { kind: "agent_call" }> => e.kind === "agent_call");
  const turns = events.filter((e): e is Extract<TraceEvent, { kind: "orchestrator_turn" }> => e.kind === "orchestrator_turn");
  const retries = agentCalls.filter((e) => e.attempts > 1).length;

  // Critical path: the role analyst, then the SLOWER of the parallel pair, plus the orchestrator's own turns
  const role = summary.agents["role_analyst"]?.ms ?? 0;
  const access = summary.agents["access_tools"]?.ms ?? 0;
  const guidance = summary.agents["guidance"]?.ms ?? 0;
  const slowerName = guidance >= access ? "Onboarding Guidance" : "Access & Tools";
  const fasterName = guidance >= access ? "Access & Tools" : "Onboarding Guidance";
  const segments = [
    { name: "Role & Project Analyst", ms: role, tone: "seg-light" },
    { name: slowerName, ms: Math.max(guidance, access), tone: "seg-strong" },
    { name: "Orchestrator turns", ms: summary.orchestrator.ms, tone: "seg-grey" },
  ];
  const totalMs = segments.reduce((s, x) => s + x.ms, 0);
  const pct = (ms: number) => (totalMs ? Math.round((ms / totalMs) * 100) : 0);

  const tokenRows = [
    { name: "Orchestrator", model: turns[0]?.model ?? "", tokens: summary.orchestrator.tokens },
    ...agents.map(([key, a]) => ({ name: AGENT_LABEL[key] ?? key, model: agentCalls.find((e) => e.agent === key)?.model ?? "", tokens: a.tokens })),
  ].sort((a, b) => b.tokens - a.tokens);
  const maxTokens = Math.max(...tokenRows.map((r) => r.tokens), 1);

  // Event times relative to the start of the run (first turn's end minus its duration)
  const start = turns[0] ? Date.parse(turns[0].at) - turns[0].ms : 0;
  const logged = events.filter((e) => e.kind !== "tool_step");

  return (
    <div className="stack-24 trace">
      <div className="kpis">
        <Kpi label="Total time" value={seconds(totalMs)} sub="from request to summary" />
        <Kpi label="Total tokens" value={summary.totalTokens.toLocaleString()} sub="orchestrator + specialists" />
        <Kpi label="Orchestrator turns" value={String(summary.orchestrator.turns)} sub="limit 10" />
        <Kpi label="Retries" value={String(retries)} sub="agent calls needing a 2nd attempt" />
        <Kpi label="Refused tool calls" value={String(summary.refusedToolCalls)} sub="blocked by guards" />
      </div>

      <section className="card stack-12">
        <h2 className="card-title">Where the time went</h2>
        <div className="timebar" role="img" aria-label={segments.map((s) => `${s.name} ${seconds(s.ms)}`).join(", ")}>
          {segments.map((s) => <div key={s.name} className={s.tone} style={{ flexGrow: s.ms }} />)}
        </div>
        <div className="row-wrap legend">
          {segments.map((s) => (
            <span key={s.name}><i className={s.tone} /> {s.name} <span className="muted">{seconds(s.ms)} · {pct(s.ms)}%</span></span>
          ))}
        </div>
        <div className="insight">
          <strong>{slowerName} is the critical path.</strong> {fasterName} ({seconds(Math.min(guidance, access))}) ran in parallel with it and added no time.
        </div>
      </section>

      <section className="card stack-12">
        <h2 className="card-title">Where the tokens went</h2>
        {tokenRows.map((r) => (
          <div key={r.name} className="token-row">
            <div><strong>{r.name}</strong><span className="muted small">{r.model}</span></div>
            <div className="track"><div style={{ width: `${(r.tokens / maxTokens) * 100}%` }} /></div>
            <span className="num">{r.tokens.toLocaleString()} · {Math.round((r.tokens / summary.totalTokens) * 100)}%</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">By agent</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Agent</th><th>Model</th><th>Time</th><th>Input tokens</th><th>Output tokens</th><th>Attempts</th><th>Result</th></tr>
            </thead>
            <tbody>
              {agentCalls.map((e, i) => (
                <tr key={i}>
                  <td><strong>{AGENT_LABEL[e.agent] ?? e.agent}</strong></td>
                  <td>{e.model}</td>
                  <td>{seconds(e.ms)}</td>
                  <td>{e.inputTokens.toLocaleString()}</td>
                  <td>{e.outputTokens.toLocaleString()}</td>
                  <td className={e.attempts > 1 ? "warn-text" : ""}>{e.attempts}</td>
                  <td><span className={e.ok ? "chip chip-done" : "chip chip-failed"}>{e.ok ? "OK" : e.failureReason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Event log</h2>
        <ol className="event-log">
          {logged.map((e, i) => (
            <li key={i}>
              <span className="muted num">+{((Date.parse(e.at) - start) / 1000).toFixed(1)}s</span>
              <code>{e.kind}</code>
              <span>{describe(e)}</span>
              <span className="muted num">{e.inputTokens.toLocaleString()} in / {e.outputTokens.toLocaleString()} out</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function describe(e: TraceEvent): string {
  if (e.kind === "orchestrator_turn") return `Turn ${e.turn} · requested ${e.toolsRequested.join(" + ") || "nothing"}`;
  if (e.kind === "agent_call") return `${AGENT_LABEL[e.agent] ?? e.agent} · ${e.attempts} attempt${e.attempts === 1 ? "" : "s"}`;
  return e.tool;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card kpi">
      <span className="muted small">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="muted small">{sub}</span>
    </div>
  );
}
