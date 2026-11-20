import type { Blocker, Status, Task } from "@onboarding/shared";

const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_approval: "Awaiting approval",
  done: "Done",
  rejected: "Rejected",
};

type Props = {
  task: Task;
  blockers: Blocker[];
  busy: boolean;
  error: string | undefined;
  onSetStatus: (status: Status) => void;
};

export function TaskRow({ task, blockers, busy, error, onSetStatus }: Props) {
  const waiting = blockers.filter((b) => b.kind !== "employee_only_conflict");
  const conflict = blockers.find((b) => b.kind === "employee_only_conflict");
  const open = task.status !== "done" && task.status !== "rejected";

  return (
    <li className="task">
      <div className="task-head">
        <div className="task-text">
          <div className="task-title">{task.title}</div>
          <div className="task-sub">
            {ownerLabel(task.owner)}
            {task.catalogueId && task.description ? ` · “${task.description}”` : ""}
          </div>
        </div>
        <span className={`chip chip-${task.status}`}>{STATUS_LABEL[task.status]}</span>
        {open && (
          <div className="task-actions">
            {task.status === "awaiting_approval" ? (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSetStatus("done")}>Approve</button>
                <button type="button" className="btn" disabled={busy} onClick={() => onSetStatus("rejected")}>Reject</button>
              </>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => onSetStatus("done")}>Mark done</button>
            )}
          </div>
        )}
      </div>
      {waiting.map((b) => (
        <div key={b.message} className="blocker">
          <LockIcon /> {b.message}
        </div>
      ))}
      {conflict && (
        <div className="conflict-line">
          <WarnIcon /> Employee-only, but this joiner is a contractor
        </div>
      )}
      {error && <div role="alert" className="alert-error">{error}</div>}
    </li>
  );
}

function ownerLabel(owner: Task["owner"]): string {
  return { coordinator: "Coordinator", new_joiner: "New joiner", approver: "Approver", it: "IT", agent: "Agent" }[owner];
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function WarnIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5v.5" />
    </svg>
  );
}
