import type {
  CaseState,
  OnboardingGuide,
  OnboardingIntake,
} from "@onboarding/shared";
import type { CaseRecord, Step, TraceEvent } from "@onboarding/shared";
export type { CaseRecord } from "@onboarding/shared";

export interface CaseStore {
  create(record: CaseRecord): Promise<void>;
  get(id: string): Promise<CaseRecord | undefined>;
  update(id: string, changes: Partial<Omit<CaseRecord, "id">>): Promise<void>;
  addStep(id: string, step: Step): Promise<void>;
  list(): Promise<CaseRecord[]>;
  addTraceEvent(id: string, event: TraceEvent): Promise<void>;
}

export class InMemoryCaseStore implements CaseStore {
  private cases = new Map<string, CaseRecord>();

  async create(record: CaseRecord) {
    this.cases.set(record.id, structuredClone(record));
  }
  async get(id: string) {
    const record = this.cases.get(id);
    return record ? structuredClone(record) : undefined;
  }
  async update(id: string, changes: Partial<Omit<CaseRecord, "id">>) {
    // “any subset of the fields, except id.” You can update anything about a case except its identity.
    const record = this.cases.get(id);
    if (!record) throw new Error(`No case "${id}"`);
    Object.assign(record, structuredClone(changes));
  }
  async addStep(id: string, step: Step) {
    this.cases.get(id)?.steps.push(structuredClone(step));
  }
  async list() {
    return [...this.cases.values()]
      .map((r) => structuredClone(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addTraceEvent(id: string, event: TraceEvent) {
    this.cases.get(id)?.trace.push(structuredClone(event));
  }
}
