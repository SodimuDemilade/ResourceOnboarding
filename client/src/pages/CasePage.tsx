import { useState } from "react";
import type { Stage, Status } from "@onboarding/shared";
import { api, ApiRequestError } from "../api";
import { useCase } from "../useCase";
import { StepTimeline } from "../components/StepTimeline";
import { TaskRow, WarnIcon } from "../components/TaskRow";
import { TracePanel } from "./TracePanel";
import { humanise } from "../scenarios";

const STAGE_ORDER: Stage[] = ["compliance", "provisioning", "orientation"];

export function CasePage({ id }: { id: string }) {
  const { view, error, replace } = useCase(id);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [showTrace, setShowTrace] = useState(false);

  if (error) return <p className="alert-error">{error}</p>;
  if (!view) return <p className="muted">Loading…</p>;

  async function setStatus(taskId: string, status: Status) {
    setBusyTask(taskId);
    setTaskErrors(({ [taskId]: _old, ...rest }) => rest);
    try {
      replace(await api.setTaskStatus(id, taskId, status)); // server returns the updated case, blockers included
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not reach the server.";
      setTaskErrors((e) => ({ ...e, [taskId]: message }));
    } finally {
      setBusyTask(null);
    }
  }

  const { intake, status } = view;
  const running = view.state === "running";
  const conflicts = view.blockers.filter((b) => b.kind === "employee_only_conflict");
  const otherBlockers = view.blockers.length - conflicts.length;
  const openTasks = view.tasks.filter((t) => (t.stage === "compliance" || t.stage === "provisioning") && t.status !== "done" && t.status !== "rejected").length;

  return (
    <div className="stack-24">
      <div className="case-header">
        <div>
          <h1 className="page-title">{intake.fullName}</h1>
          <p className="muted">
            {humanise(intake.seniority)} {humanise(intake.roleId).toLowerCase()} · Project {humanise(intake.projectId)} · {humanise(intake.contractType)} · {intake.location} · Starts {intake.startDate}
          </p>
        </div>
        <div className="row-wrap center">
          <span className={`state state-${view.state}`}>{humanise(view.state)}</span>
          {!running && (
            <button type="button" className="link-button" onClick={() => setShowTrace((s) => !s)} aria-expanded={showTrace}>
              {showTrace ? "Hide how this plan was made" : "How this plan was made"}
            </button>
          )}
        </div>
      </div>

      {showTrace && <TracePanel id={id} />}

      <div className="layout">
        <aside className="layout-side stack-12">
          <h2 className="section-title">Orchestrator steps</h2>
          <StepTimeline steps={view.steps} state={view.state} />
          {view.usage && (
            <p className="muted small">{view.usage.turns} turns · {(view.usage.inputTokens + view.usage.outputTokens).toLocaleString()} orchestrator tokens</p>
          )}
        </aside>

        <div className="layout-main stack-20">
          {view.message && (
            <section className={`card stack-12 message-${view.state}`}>
              <h2 className="card-title">{messageTitle(view.state)}</h2>
              <p className="prose">{view.message}</p>
            </section>
          )}

          {view.tasks.length > 0 && (
            <div role="status" className={status.readyToStart ? "banner banner-ready" : "banner banner-waiting"}>
              <strong>{status.readyToStart ? "Ready to start" : "Not ready to start"}</strong>
              {!status.readyToStart && (
                <span>{openTasks} tasks open · {otherBlockers} blockers · {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}</span>
              )}
            </div>
          )}

          {conflicts.map((c) => {
            const task = view.tasks.find((t) => t.id === c.taskId);
            if (!task) return null;
            return (
              <section key={c.taskId} className="card conflict-card stack-12">
                <div className="conflict-heading"><WarnIcon size={18} /><h2 className="card-title">Needs your decision</h2></div>
                <p className="prose"><strong>{task.title.replace(/^Access: /, "")}</strong> is employee-only, but {intake.fullName.split(" ")[0]} is a contractor. The Access agent recommended it: “{task.description}”</p>
                <div className="row-wrap">
                  <button type="button" className="btn" disabled={busyTask === task.id} onClick={() => setStatus(task.id, "rejected")}>Reject the request</button>
                </div>
              </section>
            );
          })}

          {view.tasks.length > 0 && (
            <div className="stack-12">
              <h2 className="section-title large">Tasks</h2>
              {STAGE_ORDER.map((stage) => {
                const tasks = view.tasks.filter((t) => t.stage === stage);
                if (tasks.length === 0) return null;
                return (
                  <section key={stage} className="card task-group">
                    <h3 className="eyebrow">{humanise(stage)}</h3>
                    <ul className="task-list">
                      {tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          blockers={view.blockers.filter((b) => b.taskId === task.id)}
                          busy={busyTask === task.id}
                          error={taskErrors[task.id]}
                          onSetStatus={(s) => setStatus(task.id, s)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {view.guide && (
            <section className="card stack-16">
              <h2 className="section-title large">First-week guide</h2>
              <p className="prose">{view.guide.summary}</p>
              <div className="days">
                {view.guide.firstWeekPlan.map((day, i) => (
                  <div key={i} className="day">
                    <span className="day-number">Day {i + 1}</span>
                    <span className="day-theme">{day.theme}</span>
                    <ul>{day.activities.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                ))}
              </div>
              <h3 className="section-title">Recommended reading</h3>
              <ul className="docs">
                {view.guide.recommendedDocs.map((d) => (
                  <li key={d.docId}>
                    <strong>{humanise(d.docId)}</strong>
                    <span className="muted">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function messageTitle(state: string): string {
  if (state === "needs_input") return "The orchestrator has a question";
  if (state === "stopped" || state === "failed") return "The run did not finish";
  return "Orchestrator summary";
}
