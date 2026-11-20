# LLM orchestrator: runs, a crash, and the workflow comparison

Recorded Nov 18, 2026. Orchestrator model: `claude-sonnet-5-5`; specialists: `claude-haiku-5-5`. Command: `npx tsx scripts/run-orchestrator.ts <happy|conflict|thin>`.

## Summary

The orchestrator is an LLM agent in a loop: it chooses which tool to call next, code checks and runs it, and the result goes back to the model, until it calls `finish` (completed), `ask_coordinator` (needs a person) or hits a limit (stopped).

1. **The model chose the right order in every run, with no guard intervention.** Role analysis first, then access planning and guidance **in the same turn** (run in parallel), then build, then finish.
2. **Its main value is the summary.** In the conflict case it explained the employee-only conflict, offered options, and stated *"I did not resolve this"*: human-in-the-loop as designed.
3. **A tool input error crashed whole runs** until invalid input was turned into feedback for the model instead of an exception.
4. **The model exposed gaps in what we told it**: which task needed approval, why the plan was not ready, and the joiner's name. Each was fixed in code, not in the prompt.
5. **Cost:** about +20–25% time and +70% tokens compared with the fixed workflow, for judgment the workflow cannot provide.

---

## Design

| Concept | Implementation |
|---|---|
| The model decides, code permits | Every tool call passes `checkTool` (dependencies, call limits) before running; refusals go back to the model as the tool result so it can correct itself |
| Hard limits the model cannot change | 10 turns, 60,000 tokens, 2 calls per specialist (first attempt + one retry) |
| State lives in code | Full agent outputs stay in `OrchestratorState`; the model receives compact summaries (fewer tokens, and it cannot alter the data) |
| The model chooses actions, not data | Specialist tools take no input; code supplies the intake |
| Parallel calls | Several tool calls in one turn run with `Promise.all` |
| Three end states, checked in code | `finish` → completed; `ask_coordinator` → needs_input; limit → stopped |

**Pre-flight test with a scripted fake model** that broke the rules on purpose:

```
turn 1 run_access_planning    BLOCKED {"error":"Requires a successful role analysis first. Call run_role_analysis."}
turn 2 run_role_analysis      ok
turn 3 run_access_planning    ok        ← same turn: parallel
turn 3 run_guidance           ok
turn 4 finish                 BLOCKED {"error":"Build and check the plan before finishing."}
turn 5 build_and_check_plan   ok
turn 6 finish                 ok
completed | 3 blockers
```

### Bugs caught during the build

| Bug | Effect if shipped | Fix |
|---|---|---|
| `state.callCounts[name]++` on an empty object | Counts became `NaN`; `NaN >= 2` is always false, so **the retry limit never fired** | `(state.callCounts[name] ?? 0) + 1` |
| `case "a" \|\| "b":` considered for the guard | Evaluates to `"a"` only; `run_guidance` would bypass the role-analysis guard | Stacked `case` labels |
| No guard requiring guidance before `finish` | The model could finish without ever running guidance | `finish` requires guidance to have been *attempted* (failure allowed) |

---

## The crash: invalid tool input

The first `conflict` and `thin` runs ended with an unhandled error at the very last step, losing a completed plan:

```
ZodError: [{ "code": "too_big", "maximum": 1500, "path": ["summary"],
  "message": "Too big: expected string to have <=1500 characters" }]
    at executeTool (src/orchestrator/tools.ts:181:37)
```

**Causes:**
- The API does not enforce `maxLength` on tool input, just as structured outputs did not enforce `maxItems`. The schema tells; Zod enforces.
- `FinishInput.parse` **threw**, and nothing caught it.

**Fix:** four checks before and around each tool call. Each turns a problem into feedback for the model instead of a crash:

| Check | Catches | The model receives |
|---|---|---|
| Unknown name | A tool that does not exist | "Unknown tool" |
| `safeParse` of the input | Invalid input, e.g. a summary that is too long | The exact Zod error, so it can shorten and retry |
| `checkTool` | A call at the wrong time or over the limit | Why it is not allowed yet |
| `try / catch` | Anything a tool throws | "Tool failed: …" |

`finish` also got a realistic limit (2,000 characters) and a description the model sees: *"under 250 words"*.

---

## Gaps the model exposed

| What the summary said | Root cause | Fix |
|---|---|---|
| *"The tool result doesn't say which task that is."* (happy) | `build_and_check_plan` returned only counts | Added `awaitingApproval`: the titles of tasks waiting for approval |
| *"The checker still reports the plan as not ready to start, and it gave no reason."* (thin, and happy) | `readyToStart` had no explanation | Added `readiness`: e.g. *"Not ready: 7 compliance or provisioning task(s) not done yet, and 0 blocker(s)."* |
| *"The guidance specialist said no name or start date was provided."* (thin) | The Guidance agent never received the joiner's name | `fullName` added to the Guidance input and the `<joiner>` tag; TypeScript listed every call site to update |
| *"No backend tech lead is named."* (conflict) | Agents never see team names, by design, so they cannot invent people | **Open:** attach the real team from `projects.json` in code |

**Lesson:** context engineering can be overdone. Give the model what it needs to *decide and explain*, including the reasons behind derived values.

---

## Workflow versus orchestrator

| Scenario | Workflow (code decides) | Orchestrator (LLM decides) | Extra cost |
|---|---|---|---|
| happy | 20.1 s, 9,461 tokens | 23.7 s, 16,346 tokens | +18% time, +73% tokens |
| conflict | 21.8 s, 11,262 tokens | 27.5 s, 18,920 tokens | +26% time, +68% tokens |

Same plan, same blockers. What the orchestrator adds: deciding whether to ask or proceed, retrying or degrading on failure, guard-checked ordering, and a summary a coordinator can act on. If the flow never varied and only the happy path mattered, the workflow would be enough; it stays in the codebase as the baseline.

---

## Outputs

### Steps chosen (all three scenarios, final runs)

```
turn 1  run_role_analysis
turn 2  run_access_planning   ┐ same turn
turn 2  run_guidance          ┘
turn 3  build_and_check_plan
turn 4  finish
```

| Scenario | Total | Orchestrator | Specialists |
|---|---|---|---|
| happy | 23.7 s | 4 turns, 7,129 tokens | 9,217 tokens |
| conflict | 27.5 s | 4 turns, 8,028 tokens | 10,892 tokens |
| thin | 28.4 s | 4 turns, 7,888 tokens | 10,055 tokens |

### Conflict: Sam Okoro, senior backend developer, contractor, Atlas

> Onboarding plan for Sam Okoro (senior backend developer, Atlas, contractor, New York, starting 2026-11-30) is built and saved: 12 tasks. 9 are not started and 3 are awaiting approval. The plan is NOT ready to start.
>
> Planned: three access requests (Northbridge client VPN, Northbridge GitLab for the Atlas repositories, Atlas production database read-only). Guidance covers the welcome and first-week plan. Recommended reading: atlas-architecture, data-protection, security-basics, ways-of-working. Tech stack: Node.js, Express, bank core banking APIs.
>
> **Blocked:**
> - All three access tasks wait on two prerequisites: signing the Northbridge Bank NDA and completing the background check. Neither is done.
>
> **Needs a human decision:**
> - Conflict: the production database read access is employee-only, but Sam is a contractor. Decide whether to reject it, grant an exception, or give an alternative such as UAT or masked data. I did not resolve this.
>
> **Gaps (not blocking the plan):**
> - The brief doesn't state what ownership a senior backend dev is expected to take.
> - The BFF integration testing tools aren't stated.
> - No backend tech lead is named.
> - It is unclear whether Sam needs Atlas UAT access for integration tests and defect investigation.
> - No sprint backlog, BFF tasks or sprint start dates are provided.
> - Meeting timings beyond the daily stand-up with the client product owner are missing.
>
> **Next actions for you:**
> 1. Start the NDA and background check now so they clear before 2026-11-30.
> 2. Decide on the production DB access conflict.
> 3. Confirm whether UAT access is needed.
> 4. Name a tech lead or buddy.
> 5. Supply the sprint backlog and meeting schedule.
> 6. Approve the VPN and GitLab requests once the prerequisites clear.

### Thin: Lena Park, mid-level business analyst, Orion: before and after the fixes

The orchestrator **carried on rather than asking the coordinator**: a partial plan (compliance, standard access, a guide) is still useful, and it turned the gaps into specific questions.

**Before** (readiness and name not provided):
> The checker still reports the plan as not ready to start, and it gave no reason. Please look at that before Lena's start date.
>
> …the guidance specialist said no name or start date was provided, so the first-week plan is organised by working day rather than calendar date. The intake does give 2026-11-30, so you may want to check the dates.

**After:**
> Onboarding plan for Lena Park (mid-level Business Analyst, Project Orion, starts 2026-11-30, New York, employee) is built and saved with 8 tasks, all not started. No blockers or conflicts. Readiness: not ready yet, because 7 compliance or provisioning tasks are still open.
>
> Planned: Guidance recommends these docs for week one: ways-of-working, security-basics, data-protection and orion-mobile-release. Access planning recommended no specific systems, so the plan has no tool-access tasks from that step.
>
> **Information gaps (not blocking, but worth filling in):**
> - Role brief: Business Analyst responsibilities on Orion, tools used, stakeholders, and how requirements reach the team are not written up. The tech stack came back empty.
> - Access: it's not stated whether she needs the Orion Firebase project (analytics or push data). It's also not stated whether she needs Harbor Mutual single sign-on for testing, or app store listings and builds. Access to these is not planned until you decide.
> - Guidance: no manager or first-days contact is named, so the people she meets on days 1 and 2 are unknown. Sprint dates and the next client demo date are missing. Her experience with requirements tools or insurance work is unknown.
>
> **Next actions for you:**
> 1. Name a manager or buddy, and the client-side product owner, for her first days.
> 2. Confirm whether she needs Firebase, SSO, or app store access, and request it if so.
> 3. Provide sprint and demo dates.
> 4. Work through the 7 open compliance and provisioning tasks before 2026-11-30.

Remaining imprecision: *"the plan has no tool-access tasks from that step"* is true, but the four baseline access tasks still exist; a coordinator could misread it. Optional fix: report the baseline items in the build result.

---

## Open items

- [ ] Unit tests for `checkTool`: guidance refused before role analysis; third role-analysis call refused; `finish` refused before the plan and before guidance is attempted
- [ ] Attach the project team from `projects.json` in code (named contacts without letting the LLM invent people)
- [ ] Evaluation case: an input where the orchestrator **should** call `ask_coordinator`
- [ ] Optional: report baseline access items in the `build_and_check_plan` result
