# Evaluation cases

A running list of behaviours to measure in the evaluation phase (days 11–13). Each case comes from something observed in a real run, not from guesswork.

**How to evaluate:** run every case **several times** (at least 5). LLM output varies between runs with identical input, so a single pass proves little. Report the **pass rate** per case, not pass or fail.

**Check types:**
- **Code:** a deterministic check on the JSON (e.g. "array is empty", "contains this ID"). Cheap and exact.
- **Judgment:** needs reading the text (by you, or later by a separate grading model). Slower; reserve for what code cannot check.

---

## Role & Project Analyst

| ID | Input | Rule | Check | Origin |
|---|---|---|---|---|
| RA-1 | Atlas frontend-dev senior | **`keyContacts` never contains roles absent from the brief.** Allowed for Atlas: client product owner, QA engineer, backend developer, frontend developer | Code: every entry is in the project's allowed list | Nov 16: `"tech lead"` added while also reporting *"the brief does not name a tech lead role"* |
| RA-2 | All cases | `keyContacts` never contains a personal name | Code: no entry matches a name from `projects.json` teams | Design rule |
| RA-3 | Orion business-analyst mid | Every responsibility has `source: "role_description"` | Code | Nov 16 v1: invented Orion-specific BA duties |
| RA-4 | Orion business-analyst mid | `missingInformation` mentions the unwritten BA responsibilities | Judgment | Planted gap in the Orion brief |
| RA-5 | Orion business-analyst mid; Nova business-analyst junior | `techStack` is empty | Code | Nov 16 v1: filler like *"Project tooling (not specified)"* |
| RA-6 | All cases | No responsibility is a meeting, way of working, access step or compliance task (stand-up, VPN, NDA) | Judgment | Nov 16 v1: stand-ups and NDAs listed as responsibilities |
| RA-7 | Atlas backend-dev senior | A responsibility about investigating production defects, `source: "brief"` | Judgment | Needed for the conflict scenario |
| RA-8 | All cases | No mention of access, approvals, NDAs or contract type | Code: keyword search | Nov 16: *"Timing and approval path for the production database read access"* |

## Access & Tools

| ID | Input | Rule | Check | Origin |
|---|---|---|---|---|
| AT-1 | Atlas backend-dev senior | Includes `atlas-prod-db-read` | Code | Conflict scenario depends on it |
| AT-2 | Atlas frontend-dev senior | Does **not** include `atlas-prod-db-read` | Code | Checks it judges need rather than adding everything |
| AT-3 | Orion business-analyst mid | `items` is empty | Code | Nov 16: no evidence of need for any project item |
| AT-4 | All cases | No mention of NDAs, background checks, contract type or approval status | Code: keyword search | Nov 16 v1: *"the status of these checks is not provided"* |
| AT-5 | All cases | `missingInformation` repeats no gap from the role profile | Code: no exact or near-exact match | Nov 16: three gaps copied word for word |
| AT-6 | All cases | Each justification cites evidence from the brief or role profile, not a generic reason | Judgment | Design rule |
| AT-7 | Atlas frontend-dev senior | Consistency of judgment calls (`atlas-client-email`, `atlas-uat`) across runs | Code: count how often each appears | Nov 16: client email recommended for frontend but not backend on similar evidence |

## Onboarding Guidance

| ID | Input | Rule | Check | Origin |
|---|---|---|---|---|
| OG-1 | All cases | Days 1–2 activities assume no project or client system access | Judgment | Design rule |
| OG-2 | All cases | Activities refer to documents by title, never by ID | Code: no `docId` string appears in activities | Nov 16: *"Read the orion-mobile-release document"* |
| OG-3 | All cases | `missingInformation` repeats no gap from the role profile | Code | Nov 16: Orion guide copied four gaps |
| OG-4 | All cases | No invented people, roles, meetings or systems | Judgment | Nov 16: *"your team lead"* on Orion, a role the brief never mentions |
| OG-5 | Orion business-analyst mid | Does not present `role_description` duties as confirmed project work | Judgment | Design rule |
| OG-6 | Junior vs senior, same project and role | Junior plan has more reading and pairing; senior reaches hands-on work sooner | Judgment: compare the two | Seniority rule |
| OG-7 | All cases | Completes without truncation | Code: `ok: true` | Nov 16: first Atlas guide truncated at 2,500 tokens |

## Pipeline and cost

| ID | Input | Rule | Check | Origin |
|---|---|---|---|---|
| PL-1 | All cases | Total time ≈ Analyst + slowest of Access and Guidance | Code: timings | Parallel step |
| PL-2 | All cases | Record input, output and thinking share of tokens per agent | Code: `usage` | Nov 16: `['thinking', 'text']`; more than half of output tokens are reasoning |
| PL-3 | Atlas frontend-dev senior | Compare quality and cost with reduced thinking | Code + judgment | Open question from PL-2 |
