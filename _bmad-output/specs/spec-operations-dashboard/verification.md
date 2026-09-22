# Verification, preservation and rollout requirements

## Source preservation and authority

Both source documents are adopted companions, remain unmodified and must be read in full. Product sections 1–25 retain their product principles, field catalogues, edge cases, non-functional requirements, acceptance scenarios and later-only exclusions. Handoff discovery, guardrails, technical-design requirements, test matrix and definition of done remain constraints. Its mission to implement, recommended Story 0–8 sequence and suggested prompt to propose stories are process instructions superseded by the current user’s spec-only request; they do not authorize code, migrations, investigative code spikes or story output.

| Product requirements | Canonical destination |
|---|---|
| FR-01, FR-02 | CAP-1/2; period contract; Q2/Q9. |
| FR-03, FR-04, FR-05 | CAP-3; order/day contract; Q5/Q8. |
| FR-06, FR-07 | CAP-4; status/count mapping; adopted Q4/Q6. |
| FR-08, FR-09, FR-10 | CAP-5; delivery boundary; Q3/Q10. |
| FR-11, FR-15 | CAP-6; deterministic warning catalogue; Q1/Q7/Q9. |
| FR-12, FR-13 | CAP-7; drawer reuse; C1/Q13. |
| FR-14 | CAP-8; scoped sync evidence; Q11/Q12. |
| FR-16 | CAP-1; role/landing evidence; A1. |

Handoff technical outputs 1–2 and 10 are covered by brownfield.md; 3–9 by data-contract.md; 11–13 below; 14 by SPEC questions and the contradiction table. Provider, current-task bike scope, order inclusion and selected-period refresh are adopted in the coaching decisions/spine. Measurable latency values remain a baseline-driven rollout check (Q14).

## Acceptance verification map

| Product scenario | Required proof |
|---|---|
| 1: 12/12 ready pickup | Database count/status fixture and UI: outgoing only as scheduled, no delivery/readiness warning. |
| 2: imminent 10/12 | Test more than 6 hours as low emphasis, exactly 6 hours as warning, just above 2 hours as warning, exactly 2 hours and overdue as critical. Count fixture, explicit two-bike warning and one-click existing drawer; handed-over/later lifecycle tasks do not inflate outstanding preparation. |
| 3: fallback address/location | Verify delivery_address wins when both fields exist; empty delivery_address uses maps_link_order with no missing-address warning; both empty shows missing. A route-resolution failure preserves the supplied value and shows drive time unavailable. Google is approved; verify supported Maps-link resolution, Google attribution, separate estimate loading and graceful failure during implementation. Shared fallback integration is not implemented yet. |
| 4: missing future address | Next-seven-day membership; warning/count present without premature preparation urgency. |
| 5: unroutable address | Provider failure/timeout/quota fixture; address preserved and “Drive time unavailable”; core workload available. |
| 6: tomorrow 0/6 | Readiness visible without Today critical treatment. |
| 7: owner-approved replacement | With seven current reconciled bike tasks all ready, show 7/7 even if Booqable has eight booked units. With eight current tasks and six ready, show 6/8. Verify retained history does not inflate scope; zero current tasks must be visible and highlighted without asserting a cause or all-ready state; mixed lifecycle must display a breakdown (3 ready, 3 in rental, 2 to prepare) with only two preparation-outstanding tasks; zero-task highlighting is identical across dates/directions and never escalates with time or creates an urgency notification. |
| 8: incoming only | Stop-based membership with no outgoing inflation. |
| 9: same-day | One row in each section; each direction’s totals agree; any unique-order metric explicitly named. |
| 10: sync problem | Failure, partial cursor, stale worker, skipped result, repeated-page protection and successful retry recovery; no falsely complete empty list. |
| 11: roles | Root/password login/callback defaults for staff/partner, preserved explicit-next behavior as approved in A1, pending/anonymous direct-route and direct-call denial. |

Additional matrix: all six periods and inclusive custom dates; preparation workload equals current to_prepare/being_prepared/needs_recheck tasks for selected-period outgoing orders across row/day/summary, excluding incoming-only and later lifecycle work; today-row readiness urgency persists in Next 7 Days/custom ranges while future rows remain non-urgent; Madrid midnight, month/year rollover and both spring/fall DST transitions; reassignment and closed-instance history; partner synthetic quantity; no checklist/add-on row inflation; new/draft/canceled/archived exclusion from rows and totals even with retained tasks and in-range dates; reserved/started/stopped inclusion by independent scheduled start/return membership; missing Booqable order number remains included with explicit missing-number text and working local-ID drawer navigation; no customer/reference; mixed fulfillment; current lifecycle beyond ready; current configuration/add-on/source notices; scoped health timestamp versus unrelated latest run; no unsupported webhook/global coverage; range preservation on drawer open/close/back/forward; shared drawer current-task links reach existing Workshop screens, omit history and preserve staff-only task access; keyboard/focus and non-color status; partner isolation and zero denied provider calls; aggregate totals equal day/order rows without join fan-out. No cross-order tight-turnaround detection ships in V1. Verify the per-order breakdown still exposes returned/awaiting storage preparation separately from prepare_for_storage/in-progress storage work, alongside preparation and in-rental counts.

## Existing test and execution infrastructure

- Node test runner: `src/workshop-ui.test.mts`, `workshop-sync.test.mts`, `booqable-source-apply.test.mts`, `order-stock-tags.test.mts`, `pending-layout.test.mts`, `trusted-role-assignment.test.mts`; includes source-inspection checks as well as executable helpers, not equivalent to browser proof.
- pgTAP/local Supabase: `supabase/tests/database/{workshop_foundation,workshop_queue,workshop_source_apply,workshop_sync,workshop_task_addons,trusted_role_assignment}.test.sql`. `npm run test:db` is explicitly local.
- Fixture/schema reuse: `src/lib/booqable/fixtures/source-order-snapshot-v1.json`, `src/lib/workshop/domain/source-snapshot.ts`; preserve atomic/fenced reconciliation and mixed-evidence regression cases.
- Workshop date tests cover Madrid formatting and manual date eligibility. No complete Operations DST/calendar/browser acceptance suite was found. No browser E2E runner is listed in package.json; choose an appropriate verification mechanism when implementation begins.
- Available quality commands include lint, build, TypeScript and focused package test scripts. Inspected GitHub workflows deploy migrations; they do not constitute a tested CI quality gate for this feature.

This documentation run verifies artifact structure, links, preservation and diff scope only. No application, database, browser, live provider, load or deployment tests are claimed to have run.

## Performance and observability

Core workload query count must not scale one request per displayed order. Fetch coherent SQL aggregation, scoped sync evidence and on-demand selected-order detail; isolate bounded routing work with within-load deduplication and no persistent/cross-request route-result cache. Measure database execution/query plan, server latency, initial usable view and route failure behavior with realistic day/month/custom data and independent routing latency/failure. Q14 must set the measurable latency/volume acceptance target from evidence; no hosted telemetry was accessed. Retain contextual error logs and distinguish query, auth, sync and routing failure without logging customer address payloads unnecessarily.

## Migration and rollout boundary

No migration is authored or applied by this specification. Current task scope supplies bike counts; no source-line classifier or independent expected-unit data is required. Using the approved Q5 eligibility matrix, decide the smallest read-model change and verify it against actual local schema. If SQL becomes necessary, use idempotent migration conventions, authenticated/RLS-safe reads, explicit staff authorization, generated types or equivalent validated contract work, and local upgrade/replay/permission tests. Do not repair source data or redefine reconciliation as an incidental dashboard change.

`.github/workflows/deploy-staging.yml` and `deploy-production.yml` run Supabase CLI 2.115.0 migrations from staging/main pushes. Hosted migrations follow merge/CI; no manual remote DDL. Preview/staging Booqable sync is intentionally gated off; fixture-based verification must not bypass this. No general feature-flag infrastructure was found. Rollback design should restore prior staff landing/navigation and disable new route-provider calls while preserving Orders, Workshop and assignment history; any later schema change needs its own compatibility/rollback assessment. Do not invent destructive rollback SQL.

## Validation verdict

Coherence: five kernel fields, eight unique stable capabilities with intent/success, explicit non-goals, testable success signals and lean companions. Conditional behaviors remain blocked by named questions; this is a completed discovery spec, not unconditional implementation readiness.

Preservation: all 16 functional requirements, all 11 acceptance scenarios, with scenario 7 explicitly superseded by the owner-approved task-ownership decision, product sections 1–25 and handoff guardrails/test requirements are retained through mandatory adopted companions and the mapping above. Wrapper-only content: upstream implementation commands/story sequencing are retained for provenance but not executed or converted into a new story artifact. The owner explicitly revised the independent expected-unit/missing-task requirement during architecture coaching; SPEC.md records its precedence over the unchanged source documents.

## Architecture acceptance additions

Selected-period refresh requires fixed stored run dates, outgoing/incoming discovery, local candidates whose source status/dates moved, order-ID deduplication, bounded resumable progress, truthful skipped/failed/success counts and legacy-scope labels. Existing reserved-only fixtures must remain valid for their original scope. Broader discovery must preserve existing guarded source-apply/task-creation behavior. No runtime evidence is claimed by this documentation update.

Reviewer regression cases: a locally eligible order outside the saved sync window must not enter the run; a locally captured in-window order must still refresh after source cancellation/date movement. A late route estimate for address A must not display beside address B after source changes; bind estimates to their origin/destination inputs.
