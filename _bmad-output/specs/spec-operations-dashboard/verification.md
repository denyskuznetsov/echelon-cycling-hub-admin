# Verification, preservation and rollout requirements

## Source preservation and authority

Both source documents are adopted companions, remain unmodified and must be read in full. Product sections 1–25 retain unchanged principles, field catalogues, edge cases, non-functional requirements, acceptance scenarios and later-only exclusions, subject to the explicit replacements below. ARCHITECTURE-SPINE.md AD-1 through AD-12 is an adopted companion, owned by the architecture workflow; this spec run does not edit it. Handoff discovery, guardrails, technical-design requirements, test matrix and definition of done remain constraints. Its mission to implement, recommended Story 0–8 sequence and suggested prompt to propose stories are process instructions superseded by the current user’s spec-only request; they do not authorize code, migrations, investigative code spikes or story output.

| Original claim / decision | Reconciled authority |
|---|---|
| Product §§11/13/18/19, FR-07, scenario 7; handoff classifier/mismatch requirements | AD-1/5 and CAP-3/4 replace expected booked units with current Workshop task scope. No independent completeness audit; 7/7 may be correct despite eight booked units. Zero tasks stays visible without escalation; history is excluded and current partner units retained. |
| Product §§7.3/14, FR-08, scenario 3; handoff existing fallback assumption | AD-8 defines nonblank delivery_address then maps_link_order, never billing/customer fallback. The fields exist but shared fallback integration is required; supplied-unresolvable is distinct from missing. |
| Product §§14/18/25 and handoff routing cache/provider requirements | AD-9 selects Google v2 DRIVE/TRAFFIC_UNAWARE with within-load deduplication, no persistent/cross-request result cache, tested destinations, separate loading and matching-input estimates. Provider setup and real-world validation remain rollout work. |
| Product §§7.2/11 preparation-window ambiguity | AD-5 counts outstanding current preparation-stage tasks for selected-period outgoing orders, not a rolling 24 hours. Preparation practice is context, not permission for early-preparation automation. |
| Product §§8/9/15.1/25, FR-02/11; handoff provisional dates/urgency | AD-4/6 settle calendar presets, inclusive custom dates, shared reference instant and exact 6h/2h boundaries. Urgency follows today's outgoing rows in every selected range; future rows remain planning-only. |
| Product §§12/15/18/25 optional tight-turnaround | AD-6 defers cross-order prediction beyond V1; AD-5 still exposes in-rental, returned and storage-in-progress separately. |
| Product §19 existing eligibility assumption | AD-2 includes reserved/started/stopped only; missing customer/number and zero tasks do not exclude eligible orders. Missing timestamps cannot qualify their direction. |
| Product §16, FR-13; handoff existing reverse-link assumption | AD-7 requires extending the shared drawer with selected-order, staff-authorized current task links; no historical browser or duplicate detail UI. |
| Product §§4/10/17, FR-14; handoff upcoming-sync reuse scope | AD-10/11 extend the existing worker to fixed selected-period outgoing OR incoming coverage plus local candidates from the same interval. Preserve old reserved-only evidence, resume and guarded reconciliation effects. |
| Product §18 optional server aggregation; handoff view/function/server choice | AD-3 requires one staff-authorized PostgreSQL SECURITY INVOKER read function, coherent aggregates and no N+1 detail loading. |
| Product §20, FR-16, scenario 11; original A1 | AD-7/12 settle Dashboard naming/first nav item/default Today, retain Workshop and explicit valid internal next destinations, and preserve partner/pending handling. |
| AGENTS.md webhook/seeder-only service role; original Q12 | Recorded owner exception in AD-12 permits service role only inside existing backend reconciliation after staff authorization, including resume. It never permits privileged Dashboard/drawer reads. |
| Product §22 performance and handoff numerical targets | Q14 remains a baseline-driven pre-rollout acceptance decision; scanability targets do not establish query/render latency. |

| Product requirements | Canonical destination |
|---|---|
| FR-01, FR-02 | CAP-1/2; AD-4/7. |
| FR-03, FR-04, FR-05 | CAP-3; AD-1/2/3/5/8; data-contract.md page/field catalogues. |
| FR-06, FR-07 | CAP-4; AD-1/5; FR-07 replaced as above. |
| FR-08, FR-09, FR-10 | CAP-5; AD-8/9. |
| FR-11, FR-15 | CAP-6; AD-4/5/6. |
| FR-12, FR-13 | CAP-7; AD-1/7/12. |
| FR-14 | CAP-8; AD-10/11/12. |
| FR-16 | CAP-1; AD-7/12. |

Handoff technical outputs 1–2 and 10 are covered by brownfield.md and AD-7/12; 3–9 by data-contract.md and AD-1 through AD-11; 11–13 below; 14 by the override table and Q14. Its proposed story sequence is not a current dispatch contract; no stories.yaml exists.

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
| 11: roles | Root/password login/callback defaults for staff/partner, preserved explicit-next behavior under AD-7, pending/anonymous direct-route and direct-call denial. |

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

No migration is authored or applied by this specification. Current task scope supplies bike counts; no source-line classifier or independent expected-unit data is required. Implement the AD-3 read function under AD-1/2 scope rules and verify against actual local schema; selected-period run metadata/validation must support AD-10/11 without changing legacy evidence meanings. If SQL becomes necessary, use idempotent migration conventions, authenticated/RLS-safe reads, explicit staff authorization, generated types or equivalent validated contract work, and local upgrade/replay/permission tests. Do not repair source data or redefine reconciliation as an incidental dashboard change.

`.github/workflows/deploy-staging.yml` and `deploy-production.yml` run Supabase CLI 2.115.0 migrations from staging/main pushes. Hosted migrations follow merge/CI; no manual remote DDL. Preview/staging Booqable sync is intentionally gated off; fixture-based verification must not bypass this. No general feature-flag infrastructure was found. Rollback design should restore prior staff landing/navigation and disable new route-provider calls while preserving Orders, Workshop and assignment history; any later schema change needs its own compatibility/rollback assessment. Do not invent destructive rollback SQL.

## Architecture acceptance map

| Rules | Required proof beyond the product scenarios |
|---|---|
| AD-1/5 | Count each current rental_turnaround task once on an open assignment; exclude cancelled/closed history; include completed while open. Dashboard and selected-order links use the same predicate, including partner units. Preserve separate returned/storage counts and zero-task non-escalation. |
| AD-2/3 | Independent start/return membership, missing timestamps/names/numbers, eligible zero-task rows, no join fan-out, one coherent rows/day/period dataset and explicit failed-read state. No silent partial delivery or unapproved range cap. |
| AD-4/6 | Default Today, malformed/reversed date errors, next Monday even when today is Monday, next calendar month, inclusive custom endpoints, both DST transitions and one reference instant for membership/labels/urgency. Preserve chronology, distinct conditions and highest existing severity without duplicate alert cards. |
| AD-7/12 | Direct RPC/task-link/ETA/start/resume role denial, not just navigation; user RLS reads and narrow backend-worker exception. Default staff landing, explicit next, partner/pending behavior, retained Workshop, drawer history/focus/period state and on-demand links. Do not overwrite workload snapshot counts with later detail data. |
| AD-8/9 | Whitespace/primary/maps/missing parity between SQL and shared display; supplied-unresolvable is not missing. ETA authorization/server input reread, minimal provider payload, no secrets/arbitrary proxy, tested destination forms and bounded safe redirects if supported. Timeout/quota/ambiguity leaves workload usable. A late estimate for A never displays beside B; no persistent/cross-request cache, polling or drawer-only refetch. |
| AD-10 | Selected-period outgoing/incoming source discovery plus local in-window candidates; deduplicate IDs. An out-of-window local order must not enter; captured candidates still reconcile after source cancellation/date movement. Persist exact scope/window/policy/run, discovery and outcomes across pause/resume, midnight and URL changes; client cursor cannot widen scope. Preserve bounded awaited work, leases, complete snapshots, task creation and guarded whole-order effects. |
| AD-11 | Success requires complete enumeration and all required reconciliations; retries replace outcomes and skipped/deleted/unavailable candidates cannot become successes. Keep scope/date/completion/counts from one run, distinguish stale/unknown/failed/partial/empty, show recorded dates after navigation and preserve legacy labels. No global or atomic-source-snapshot claim. |
| AD-12 | Preserve environment sync gates, old scopes/cursors readable or explicitly restartable, idempotent local migration verification and hosted CI path. Rollback restores prior staff landing/navigation and disables new routing/selected-period entry points while retaining Orders/Workshop/source/task history. |

## Remaining rollout checks

- **Q14:** Measure database plan/time, server response, first usable workload and selected-period sync throughput using representative Today/month/custom volumes and actual staff devices; agree numerical acceptance targets before rollout.
- **Routing:** Verify precise shop origin, real supported Maps-link fixtures, ambiguity handling, applicable billing-account terms/privacy notices, restricted credentials, attribution and quotas before enabling estimates. Recorded provider research is dated evidence, not a new live check.
- **Execution:** Select and test bounded query/provider/concurrency/sync budgets during implementation. An incomplete custom range must fail/resume explicitly; a new user-visible range cap requires product approval. The separate optimization research does not approve batching/concurrency changes here.

## Validation verdict

Coherence: eight stable CAP IDs have intent and success; the lean kernel retains five required fields, explicit non-goals and testable outcomes. A1 is resolved behavior, historical repository evidence is qualified in brownfield.md, no new assumptions were introduced, and only Q14 remains an open acceptance decision. The contract is reconciled with the final architecture; runtime and rollout verification remain future work.

Preservation: all 16 functional requirements, all 11 acceptance scenarios, product sections 1–25 and handoff guardrails are retained through required companions with the explicit replacements above. All twelve architecture decisions are adopted unchanged and mapped to verification. Wrapper-only content: original implementation missions, story sequencing, suggested prompts and coaching/review process records do not become build requirements or authorize execution. No application, migration, story, browser, provider or deployment test is claimed by this documentation reconciliation.
