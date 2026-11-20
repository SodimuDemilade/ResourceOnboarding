import { useEffect, useState } from "react";
import type { CaseListItem } from "@onboarding/shared";
import { api } from "../api";
import { hrefFor } from "../useHashRoute";
import { humanise } from "../scenarios";

export function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listCases()
      .then((list) => {
        if (!cancelled) setCases(list);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="alert-error">{error}</p>;
  if (!cases) return <p className="muted">Loading cases…</p>;

  return (
    <div className="stack-24">
      <div>
        <h1 className="page-title">Cases</h1>
        <p className="muted">Every onboarding started, newest first.</p>
      </div>

      {cases.length === 0 ? (
        <div className="card stack-12">
          <p>No onboardings yet.</p>
          <a href={hrefFor({ page: "new" })}>Start one</a>
        </div>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Joiner</th>
                  <th>Project</th>
                  <th>State</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={hrefFor({ page: "case", id: c.id })}>
                        <strong>{c.fullName}</strong>
                      </a>
                    </td>
                    <td>{humanise(c.projectId)}</td>
                    <td>
                      <span className={`state state-${c.state}`}>
                        {humanise(c.state)}
                      </span>
                    </td>
                    <td className="muted">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
