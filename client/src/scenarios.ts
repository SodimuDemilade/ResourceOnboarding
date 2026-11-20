// Pre-filled intakes for the live demo (same as the server scripts)
export const SCENARIOS = {
  happy: { label: "Happy path", hint: "Priya · Nova · employee", intake: { fullName: "Priya Shah", roleId: "frontend-dev", projectId: "nova", seniority: "junior", startDate: "2026-11-30", contractType: "employee", location: "New York" } },
  conflict: { label: "Conflict", hint: "Sam · Atlas · contractor", intake: { fullName: "Sam Okoro", roleId: "backend-dev", projectId: "atlas", seniority: "senior", startDate: "2026-11-30", contractType: "contractor", location: "New York" } },
  thin: { label: "Thin brief", hint: "Lena · Orion · business analyst", intake: { fullName: "Lena Park", roleId: "business-analyst", projectId: "orion", seniority: "mid", startDate: "2026-11-30", contractType: "employee", location: "New York" } },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

/** "atlas-architecture" → "Atlas architecture" */
export function humanise(id: string): string {
  const text = id.replace(/[-_]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
