---
title: 'Story 1.4: Refresh the selected period and recover interrupted syncs'
type: feature
created: '2026-09-23'
status: done
baseline_revision: '3e527d92d1312076f2bac6525e271145d198e68b'
baseline_commit: '3e527d92d1312076f2bac6525e271145d198e68b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Dashboard shows local workload but cannot explicitly refresh both departures and returns for its selected dates or recover an interrupted refresh. Existing Workshop sync evidence covers reserved starts only and must not be presented as selected-period coverage.

**Approach:** Extend the current manual sync run, discovery, and reconciliation flow with a saved selected-period scope and bounded continuation. Add Dashboard controls that show one run's progress, result, dates, errors, and recovery while leaving workload visible.

## Boundaries & Constraints

**Always:** Staff authorization at start and resume; preserve `workshopSyncAllowed`, per-order leases/fences, full-snapshot atomic apply, guarded whole-order pickup/return, legacy scope meanings, user-RLS dashboard reads, Madrid/DST-safe bounds, source-local candidate deduplication, truthful same-run outcomes, and Workshop-consistent language. Persist run ID, scope/policy version, exact dates and instants, discovery checkpoint, pending IDs, and replaceable per-order outcomes. Reconcile locally captured candidates after source cancellation or date movement. Resume saved server state after URL/midnight changes. Use bounded awaited work and explicit errors. Author and apply only idempotent local migrations; remote migration follows CI.

**Block If:** A required provider listing cannot enumerate status/start/return candidates accurately with the verified read contract; a schema or authorization boundary cannot preserve old run data or the existing environment gate; completion would require an unapproved user-visible range cap.

**Never:** Introduce a scheduler, detached promise, second worker, live Booqable write-back, per-bike fulfillment, backward transitions, missed-stage replay, service-role dashboard reads, global or atomic-snapshot coverage claims, or new confidence status vocabulary. Do not access a live tenant or deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Both directions | Reserved/started/stopped orders start or return in saved interval; one appears in both | One Booqable ID per run; authoritative snapshot reconciled | Source page error leaves resumable incomplete run |
| Stale local row | Locally eligible at start, then canceled or moved at source | Captured ID still fetched/applied; obsolete row leaves Dashboard | Deleted/unavailable stays explicit failure |
| Continuation | Large run, URL change or Madrid midnight | Saved dates/bounds/checkpoint/IDs and bounded next request reused | Mismatched/tampered cursor rejected without widening |
| Retry | Failed/skipped/deleted candidate later retried | Outcome replaces old one; success only after full enumeration and required success | Failure and recovery remain visible |
| Empty/legacy | No eligible IDs, or old reserved-only run | Completed empty run is distinct; old run keeps original scope label | Unknown/stale/incomplete evidence never claims coverage |
| Direct denial | Partner/pending/anonymous or disabled environment | No privileged reconciliation/provider call | Clear denied or unavailable result; expired session redirects |

</intent-contract>

## Code Map

- `src/lib/workshop/actions/sync-actions.ts:17` -- `withAuth` start/resume and user-client RPC pattern; add selected-period entry without weakening role checks.
- `src/lib/workshop/application/manual-sync.ts:150` -- current reserved-only discovery/worker; bound pages per request and preserve reconciliation path.
- `src/lib/workshop/application/reconcile-order.ts:102` -- existing env gate, lease/fence, full snapshot and atomic source apply; reuse unchanged unless required by scoped continuation.
- `src/lib/workshop/domain/commands.ts:15` -- legacy scopes/cursor and start-only eligibility; version selected-period state separately.
- `src/lib/booqable/fetch-source-snapshot.ts:188` -- list parser omits return timestamp; verify source list fields/status and filter complete pages against saved bounds.
- `supabase/migrations/20260822120000_workshop_sync.sql:21` -- run schema, staff start/resume RPCs, privileged record/finish grants, health view; extend through a new idempotent migration.
- `supabase/migrations/20260826120000_workshop_sync_retry_counters.sql:6` -- replace outcomes/recompute counters on retry.
- `src/lib/dashboard/period.ts:92` -- validated resolved Madrid dates/reference; server must revalidate before run creation.
- `src/app/dashboard/page.tsx:28` and `src/app/dashboard/_components/DashboardWorkload.tsx:167` -- replace sync placeholder with controls beside URL-owned period; keep lists usable.
- `src/app/workshop/_components/WorkshopQueue.tsx:222` -- familiar messages/Progress/Alert language, but its blocking overlay is unsuitable for Dashboard.
- `src/lib/workshop/data/sync-health.ts:50` -- old health view mixes last success and latest run; selected-period detail must derive from one run.
- `supabase/tests/database/workshop_sync.test.sql`, `src/workshop-sync.test.mts`, `src/dashboard-ui.test.mts` -- SQL, worker and rendered UI verification seams.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260923150000_dashboard_selected_period_sync.sql` -- add idempotent selected-period metadata/checkpoint storage, staff start/resume authorization, server-owned continuation and same-run outcome/completion contract; preserve old scopes, grants and data.
- `src/lib/booqable/fetch-source-snapshot.ts` and `src/lib/workshop/domain/commands.ts` -- parse needed list fields and define versioned saved-window discovery/eligibility without changing legacy meanings.
- `src/lib/workshop/application/manual-sync.ts` -- discover source start OR return plus captured local in-window IDs, deduplicate, durably checkpoint bounded pages/work, retry outcomes and resume using server scope.
- `src/lib/workshop/actions/sync-actions.ts` and `src/lib/workshop/data/sync-health.ts` -- add authorized selected-period start/resume and one-run progress/result/error reads under the existing environment gate.
- `src/app/dashboard/page.tsx` and `src/app/dashboard/_components/DashboardWorkload.tsx` -- add explicit refresh, progress, saved-range details, failure and resume/restart controls; leave local lists usable across navigation.
- `supabase/tests/database/workshop_sync.test.sql`, `src/workshop-sync.test.mts`, `src/dashboard-ui.test.mts` -- cover matrix, direct authorization, legacy compatibility, source-apply regression and rendered asynchronous states.
- `_bmad-output/implementation-artifacts/spec-1-4-refresh-the-selected-period-and-recover-interrupted-syncs.md` -- record fixture, local upgrade/replay, browser and throughput evidence separately from unverified live/rollout gates.

**Acceptance Criteria:**
- Given valid selected Madrid dates and authorized staff, when Refresh starts, then the recorded run contains fixed dates/bounds/policy and discovers eligible start OR return source IDs plus only local in-window candidates, deduplicated by Booqable ID.
- Given a captured candidate whose source status or dates change, when its authoritative snapshot is reconciled, then the local projection is updated through the existing guarded worker and an obsolete Dashboard row can leave.
- Given bounded work pauses, URL changes, midnight, or a tampered cursor, when Resume is requested, then the server continues only its saved interval/checkpoint and each request durably awaits a bounded portion without expanding scope.
- Given enumeration, retries, skips and unavailable candidates, when run detail is shown, then success requires complete enumeration and every required reconciliation, counters reflect final per-ID outcomes, and failures remain explicit until resolved.
- Given selected-period and legacy history, when staff view another date range or return later, then visible scope/dates/state/counts come from one run and old reserved-only evidence never asserts selected-period or global coverage.
- Given direct start/resume from staff, partner, pending, anonymous, or a disabled environment, when attempted, then only authorized, enabled staff reach privileged reconciliation/provider work; dashboard reads retain user RLS and expired sessions follow `withAuth` login behavior.
- Given refresh is advancing or fails, when the Dashboard renders, then period controls and workload remain usable with familiar text-based progress/result/error, saved-range detail, and an applicable resume/restart action.
- Given local upgrade or replay and prior run history, when the new schema/entry is exercised, then old scopes/cursors remain readable or explicitly restartable, existing Orders/Workshop and guarded source-apply semantics pass regression checks, and rollback needs no destructive data deletion.

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 11 (high 2, medium 9)
- defer: 0
- reject: 5
- addressed_findings:
  - `[high]` `[patch]` Keep older unfinished selected runs available for explicit recovery after a newer run exists.
  - `[high]` `[patch]` Reject null or inconsistent saved metadata before resume can acquire a lease, and abort/release after worker setup failure.
  - `[medium]` `[patch]` State when the latest saved run's dates differ from the viewed dates.
  - `[medium]` `[patch]` Treat a failed health read as unknown progress, not an empty history.
  - `[medium]` `[patch]` Show the saved run's Madrid check time.
  - `[medium]` `[patch]` Keep malformed mixed source pages from advancing a checkpoint and test that behavior.
  - `[medium]` `[patch]` Persist failure and release the lease when finalization fails where the authenticated abort path is available.
  - `[medium]` `[patch]` Retire old period continuation after its current bounded request and allow the new period's controls.
  - `[medium]` `[patch]` Exercise return-phase, multi-page and multi-batch continuation through the worker.
  - `[medium]` `[patch]` Exercise Dashboard action handlers through an in-progress result and terminal continuation.
  - `[medium]` `[patch]` Verify direct authorization, disabled environment and retry behavior through the new selected path.

## Verification

**Commands:**
- `npm run test:dashboard` -- expected: dashboard period, UI and sync-state tests pass.
- `node --test src/workshop-sync.test.mts` -- expected: scoped discovery, continuation and legacy fixtures pass.
- `npm run test:db` -- expected: local SQL authorization, upgrade/replay and sync tests pass.
- `npx tsc --noEmit` and focused `npx eslint` -- expected: no new type or lint errors.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- In an authenticated local browser, exercise valid/invalid periods, long sync, navigation, saved-range recovery and list usability. Record actual device, provider, and throughput limits rather than inferring them from fixtures.

**Local implementation evidence (2026-09-23):**
- Authored and applied `20260923150000_dashboard_selected_period_sync.sql` to the local stack only. Replayed the same SQL directly against local Postgres with `ON_ERROR_STOP=1`; all statements completed. Local migration history records `20260923150000`. No reset or remote migration was used.
- After review fixes, `npm run test:dashboard`: 24 passed; `npm run test:workshop-sync`: 30 passed; `npm run test:db`: 615 passed across eight files, including 93 Workshop sync tests. `npx tsc --noEmit`, focused ESLint for changed application files, and `git diff --check` passed. Full `npm run lint` still fails on 16 existing errors outside this story (including Bike Fit components and UserContext).
- Added executable mocked action/continuation tests for return listing, two return pages, twelve reconciliation candidates over two batches, failure/retry, disabled environment, malformed mixed listing with no checkpoint, and lease abort when service setup, response parsing, or finalization fails. SQL tests cover null saved metadata and same-owner abort saving a failed run while releasing its lease. UI handlers await the continuation chain; keyed period changes retire the old chain after its current bounded request and allow controls for the new period.
- Local authenticated Chrome at `http://localhost:3000/dashboard`: Today and Tomorrow showed the refresh control above visible workload; reversed custom dates showed a correction error and disabled Refresh. Desktop layout was visually inspected. The running server's cwd matched this checkout.
- Booqable v4 published API documentation confirms order list fields `status`, `starts_at`, `stops_at` and date filters `gte`/`lt` for both scheduled fields. The fixture verifies the generated return query and parser. A live tenant call was deliberately not made under the story's boundary.
- Long-run throughput, actual Booqable pagination behavior, live provider reconciliation, phone/tablet/zoom rendering, and deployment remain unverified. Browser Refresh was not pressed because this checkout may hold live Booqable credentials, and the story prohibits live tenant access. If both finalization and the authenticated abort RPC fail, the saved run remains incomplete until its lease expires and a staff member resumes it; the action reports the failure immediately.

## Auto Run Result

Story 1.4 extends the existing manual sync run to save an exact selected Madrid interval, discover source departures and returns, reconcile captured local candidates, and resume bounded work from durable server state. The Dashboard shows the saved run's dates, check time, progress and errors while leaving workload visible, and offers recovery for older unfinished runs.

Changed files: `supabase/migrations/20260923150000_dashboard_selected_period_sync.sql` stores selected scope, bounds, candidates, checkpoints, results and protected RPCs; `src/lib/booqable/fetch-source-snapshot.ts`, `src/lib/workshop/domain/commands.ts` and `src/lib/workshop/application/manual-sync.ts` implement source discovery and guarded continuation; `src/lib/workshop/actions/sync-actions.ts` and `src/lib/workshop/data/sync-health.ts` expose authorized actions and same-run details; `src/app/dashboard/page.tsx`, `src/app/dashboard/_components/DashboardWorkload.tsx` and `DashboardSync.tsx` render the control and recovery UI; `src/workshop-sync.test.mts`, `src/dashboard-ui.test.mts` and `supabase/tests/database/workshop_sync.test.sql` verify the changed boundaries.

Review: 11 patches applied (high 2, medium 9), 0 deferred, 5 rejected as duplicate, existing parser tradeoff, or out-of-scope atomic/live-provider guarantees. Follow-up review recommended: true (patched score 27 and high findings present).

Verification: local migration apply and replay passed; 615/615 local database tests, 30/30 Workshop sync tests, 24/24 Dashboard tests, TypeScript, focused ESLint and `git diff --check` passed. Full repository lint retains 16 unrelated errors. Authenticated desktop browser showed controls and valid/invalid periods without invoking a live Booqable refresh. Actual tenant pagination, full browser sync/recovery, throughput, and phone/tablet/zoom behavior remain unverified rollout evidence.
