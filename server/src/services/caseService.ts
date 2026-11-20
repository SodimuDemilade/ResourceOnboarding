import { randomUUID } from "node:crypto";
import type {
  OnboardingIntake,
  Status,
  Task,
  CaseView,
  TraceResponse,
} from "@onboarding/shared";
import { runOrchestrator } from "../orchestrator/orchestrator.js";
import type { CaseRecord, CaseStore } from "./caseStore.js";
import type { TaskTracker } from "./taskTracker.js";
import { findBlockers, type Blocker } from "./blockerRules.js";
import { summarise, type StatusSummary } from "./statusService.js";
import { createTracer, summariseTrace } from "../tracing/tracer.js";

/** An error the API should report to the client with a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export function createCaseService(deps: {
  cases: CaseStore;
  tracker: TaskTracker;
}) {
  const { cases, tracker } = deps;

  /** Builds the full view: stored case + tasks + blockers calculated NOW. */
  async function getCase(id: string): Promise<CaseView> {
    const record = await cases.get(id);
    if (!record) throw new HttpError(404, `No case "${id}"`);
    const tasks = await tracker.getTasks(id);
    const blockers = findBlockers(tasks, {
      contractType: record.intake.contractType,
      startDate: record.intake.startDate,
      today: today(),
    });
    return { ...record, tasks, blockers, status: summarise(tasks, blockers) };
  }

  /** Creates the case and starts the orchestrator WITHOUT waiting for it. */
  async function createCase(intake: OnboardingIntake): Promise<CaseRecord> {
    const record: CaseRecord = {
      id: randomUUID(),
      intake,
      state: "running",
      createdAt: new Date().toISOString(),
      steps: [],
      trace: [],
    };
    const tracer = createTracer(
      record.id,
      (event) => void cases.addTraceEvent(record.id, event),
    );
    await cases.create(record);

    // Fire and forget: the HTTP response does not wait for this
    void runOrchestrator({
      caseId: record.id,
      intake,
      tracker,
      today: today(),
      tracer,
      onStep: (step) => void cases.addStep(record.id, step),
    })
      .then((run) =>
        cases.update(record.id, {
          state: run.outcome,
          message: run.message,
          finishedAt: new Date().toISOString(),
          usage: run.usage,
          ...(run.state.guide?.ok ? { guide: run.state.guide.data } : {}),
        }),
      )
      .catch((err: unknown) =>
        cases.update(record.id, {
          state: "failed",
          message: err instanceof Error ? err.message : String(err),
          finishedAt: new Date().toISOString(),
        }),
      );

    return record;
  }

  /** Changes one task's status, enforcing the same rules the blocker check reports. */
  async function updateTaskStatus(
    caseId: string,
    taskId: string,
    status: Status,
  ): Promise<CaseView> {
    const view = await getCase(caseId);
    const task = view.tasks.find((t) => t.id === taskId);
    if (!task)
      throw new HttpError(404, `No task "${taskId}" in case "${caseId}"`);

    if (status === "done") {
      const stopping = view.blockers.filter(
        (b) => b.taskId === taskId && b.kind !== "at_risk_for_start_date",
      );
      if (stopping.length > 0)
        throw new HttpError(
          409,
          `Cannot complete "${task.title}": ${stopping.map((b) => b.message).join("; ")}`,
        );
    }

    await tracker.updateStatus(caseId, taskId, status);
    return getCase(caseId);
  }

  async function getTrace(id: string): Promise<TraceResponse> {
    const record = await cases.get(id);
    if (!record) throw new HttpError(404, `No case "${id}"`);
    return {
      caseId: id,
      state: record.state,
      summary: summariseTrace(record.trace),
      events: record.trace,
    };
  }

  return {
    getCase,
    createCase,
    updateTaskStatus,
    getTrace,
    listCases: () => cases.list(),
  };
}

export type CaseService = ReturnType<typeof createCaseService>;
