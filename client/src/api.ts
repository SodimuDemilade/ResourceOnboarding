import type { ApiError, CaseListItem, CaseView, OnboardingIntake, Status, TraceResponse } from "@onboarding/shared";

/** An error response from the API, with the server's own message. */
export class ApiRequestError extends Error {
  constructor(public status: number, message: string, public details?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    const err = body as ApiError;
    throw new ApiRequestError(res.status, err.error ?? `Request failed (${res.status})`, err.details);
  }
  return body as T;
}

export const api = {
  createCase: (intake: OnboardingIntake) =>
    request<{ id: string; state: string }>("/cases", { method: "POST", body: JSON.stringify(intake) }),
  listCases: () => request<CaseListItem[]>("/cases"),
  getCase: (id: string) => request<CaseView>(`/cases/${id}`),
  getTrace: (id: string) => request<TraceResponse>(`/cases/${id}/trace`),
  setTaskStatus: (caseId: string, taskId: string, status: Status) =>
    request<CaseView>(`/cases/${caseId}/tasks/${taskId}/status`, { method: "POST", body: JSON.stringify({ status }) }),
};
