import { useState, type FormEvent } from "react";
import {
  ContractType,
  OnboardingIntake,
  ProjectId,
  RoleId,
  Seniority,
} from "@onboarding/shared";
import { api, ApiRequestError } from "../api";
import { SCENARIOS, humanise, type ScenarioKey } from "../scenarios";

type FormValues = {
  fullName: string;
  location: string;
  projectId: string;
  roleId: string;
  seniority: string;
  contractType: string;
  startDate: string;
};

const EMPTY: FormValues = {
  fullName: "",
  location: "",
  projectId: "atlas",
  roleId: "frontend-dev",
  seniority: "mid",
  contractType: "employee",
  startDate: "",
};

const STEPS = [
  [
    "Role & Project Analyst",
    "Works out what the role involves on this project.",
  ],
  [
    "Access & Guidance, in parallel",
    "Recommends systems and writes the first-week plan.",
  ],
  [
    "Plan and rule checks",
    "Builds tasks, checks dependencies and policy conflicts.",
  ],
  ["Summary for you", "What is blocked, and what needs your decision."],
] as const;

export function NewCasePage({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormValues, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof FormValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setScenario(null);
  };

  function fillScenario(key: ScenarioKey) {
    setValues({ ...SCENARIOS[key].intake });
    setScenario(key);
    setFieldErrors({});
    setSubmitError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Same schema as the server: the form can never send something the API rejects
    const parsed = OnboardingIntake.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        errors[field] ??=
          field === "startDate"
            ? "Required. Use a date like 2026-11-30."
            : issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await api.createCase(parsed.data);
      onCreated(created.id);
    } catch (err) {
      setSubmitError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not reach the server.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="layout">
      <section className="layout-main stack-24">
        <div>
          <h1 className="page-title">Start an onboarding</h1>
          <p className="muted">
            Enter the joiner's details. The orchestrator plans their onboarding
            and you can watch each agent work.
          </p>
        </div>

        <div className="card stack-12">
          <span className="eyebrow">Demo scenarios</span>
          <div className="row-wrap">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`scenario${scenario === key ? " is-selected" : ""}`}
                aria-pressed={scenario === key}
                onClick={() => fillScenario(key)}
              >
                <span className="scenario-label">{SCENARIOS[key].label}</span>
                <span className="scenario-hint">{SCENARIOS[key].hint}</span>
              </button>
            ))}
          </div>
        </div>

        <form className="card stack-24" onSubmit={submit} noValidate>
          <div className="grid-2">
            <TextField
              id="fullName"
              label="Full name"
              value={values.fullName}
              onChange={set("fullName")}
              error={fieldErrors.fullName}
            />
            <TextField
              id="location"
              label="Location"
              value={values.location}
              onChange={set("location")}
              error={fieldErrors.location}
            />
            <SelectField
              id="projectId"
              label="Project"
              value={values.projectId}
              options={ProjectId.options}
              onChange={set("projectId")}
            />
            <SelectField
              id="roleId"
              label="Role"
              value={values.roleId}
              options={RoleId.options}
              onChange={set("roleId")}
            />
          </div>

          <fieldset className="field">
            <legend className="label">Seniority</legend>
            <div className="segmented">
              {Seniority.options.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={values.seniority === s}
                  className={values.seniority === s ? "is-selected" : ""}
                  onClick={() => set("seniority")(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid-2">
            <fieldset className="field">
              <legend className="label">Contract type</legend>
              <div className="row-wrap">
                {ContractType.options.map((c) => (
                  <label key={c} className="radio">
                    <input
                      type="radio"
                      name="contractType"
                      value={c}
                      checked={values.contractType === c}
                      onChange={() => set("contractType")(c)}
                    />
                    {humanise(c)}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField
              id="startDate"
              label="Start date"
              type="date"
              value={values.startDate}
              onChange={set("startDate")}
              error={fieldErrors.startDate}
            />
          </div>

          {submitError && (
            <p role="alert" className="alert-error">
              {submitError}
            </p>
          )}

          <div
            className="form-footer"
            style={{ display: "flex", justifyContent: "right" }}
          >
            {/* <span className="muted small">Checked with the same schema the server uses</span> */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
            >
              {submitting ? "Starting…" : "Start onboarding"}
            </button>
          </div>
        </form>
      </section>

      <aside className="card layout-side stack-16">
        <h2 className="card-title">What happens next</h2>
        <ol className="numbered">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="badge-number">{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <span className="muted">{text}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted small divider-top">
          All project data is fictional. Access is only ever proposed; a person
          approves it.
        </p>
      </aside>
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  type?: string;
}) {
  const errorId = `${props.id}-error`;
  return (
    <div className="field">
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        className={props.error ? "input has-error" : "input"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? errorId : undefined}
      />
      {props.error && (
        <span id={errorId} className="field-error">
          {props.error}
        </span>
      )}
    </div>
  );
}

function SelectField(props: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <select
        id={props.id}
        className="input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
