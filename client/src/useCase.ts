import { useCallback, useEffect, useState } from "react";
import type { CaseView } from "@onboarding/shared";
import { api } from "./api";

const POLL_MS = 1500;

/**
 * Loads a case and keeps polling while the orchestrator is running.
 * Stops automatically when the run finishes or the component unmounts.
 */
export function useCase(id: string) {
  const [view, setView] = useState<CaseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;                         // set when the component unmounts or id changes
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const next = await api.getCase(id);
        if (cancelled) return;                     // ignore responses for a page we have left
        setView(next);
        setError(null);
        if (next.state === "running") timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  // After an action (approve, complete) the server returns the updated view; use it directly
  const replace = useCallback((next: CaseView) => setView(next), []);

  return { view, error, replace };
}
