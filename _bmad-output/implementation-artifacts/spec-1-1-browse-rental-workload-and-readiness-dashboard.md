---
title: 'Story 1.1: Browse the rental workload and readiness dashboard'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: '84d30b5d057dc8306408741eb880165874f736e2'
baseline_commit: '84d30b5d057dc8306408741eb880165874f736e2'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred:
  - 'Rendered browser verification: dashboard reflow, phone tabs, login/OAuth redirects, and drawer history still require a running authenticated browser session.'
  - 'Performance baseline: capture representative Today, month, and custom-range EXPLAIN/response evidence before a production rollout; Story 1.1 intentionally adds no unmeasured index or range cap.'
---

<intent-contract>

## Intent

**Problem:** Staff must compare Booqable, Orders, and Workshop to see a day’s departures, returns, readiness, and delivery information. The current landing route and navigation do not provide a protected operational dashboard.

**Approach:** Add a staff-only `/dashboard` route backed by one coherent PostgreSQL workload read for a URL-owned Madrid period. Reuse the shell and shared order drawer while extending them only where needed for the approved delivery display.

## Boundaries & Constraints

**Always:** Allow only admin, manager, and mechanic at the page and RPC boundary; preserve partner/pending flows. Resolve all presets and custom dates in Europe/Madrid from one captured reference instant, with inclusive local dates and independently converted DST-safe boundaries. Start from eligible orders, then left-join separately aggregated current `rental_turnaround` tasks on open assignments; count completed current tasks and exclude cancelled/history/add-on/checklist records. Resolve delivery as nonblank `delivery_address`, then nonblank `maps_link_order`, else missing. Reuse `?order=<local UUID>` and make core load errors visibly distinct from empty lists.

**Block If:** Current schema or RLS evidence conflicts with the canonical order, task, delivery, or role predicates; a required local migration cannot be applied safely; or an existing explicit internal-destination policy conflicts with redirecting malformed/external `next` values to the role default.

**Never:** Aggregate workload business data in Node or the browser; use `bookings_view` or `workshop_tasks_view` as the workload source; silently truncate rows; create a second drawer, task workflow, sync engine, ETA adapter, delivery editor, booked-unit audit, or hosted database change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Default period | Staff opens `/dashboard` without period parameters | Today in Madrid, resolved dates and one reference instant populate both directions | No error expected |
| Custom period | Valid inclusive `from` and `to` dates across a DST boundary | SQL uses local start through next local day; URL survives drawer/history | No fixed-24-hour conversion |
| Invalid period | Malformed or reversed custom dates | Correctable validation state; no broadened workload query | Explain the date error visibly |
| Eligibility/task scope | Eligible zero-task, missing-name/number, partner-unit, completed-current, and historical/cancelled-task fixtures | Eligible rows remain selectable; counts use current tasks only; zero tasks says “No Workshop tasks” | Missing identity uses explicit fallback text |
| Delivery | Delivery address, maps link fallback, whitespace, or neither | Preserve address/link provenance; both empty says “Delivery address missing” and contributes to totals | Supplied unroutable values are supplied, not missing |
| Access/read failure | Partner/pending/anonymous RPC call or workload query failure | Direct access is denied; staff page retains safe empty fallback | Log context and render `DataLoadError`, never a successful zero state |

</intent-contract>

## Code Map

- `supabase/migrations/20260608102505_remote_schema.sql:315` -- order/status/fulfillment base schema and trusted role function; do not adopt the incomplete `bookings_view` candidate predicate.
- `supabase/migrations/20260821120000_workshop_foundation.sql:87` -- assignment instance and `bike_tasks` models; dashboard current scope is open assignment plus non-cancelled `rental_turnaround` task.
- `supabase/migrations/20260917124408_workshop_booqable_order_status_sync.sql:4` -- lifecycle/source evidence fields that remain read-only in the dashboard.
- `src/lib/orders.ts:68` and `src/components/orders/OrderDetailsDrawer.tsx:226` -- selected-order loader and existing `?order` close/history behavior to extend, not replace.
- `src/components/orders/OrderDetailsDrawerHost.tsx:21` and `src/components/orders/useOpenOrderDetails.ts:5` -- mount once in the dashboard layout and use for row actions.
- `src/utils/auth/postLogin.ts:18`, `src/app/orders/layout.tsx:1`, and `src/ui/layouts/nav-config.ts:9` -- shared role landing, protected layout pattern, and staff navigation insertion point.
- `src/lib/workshop/data/tasks.ts:45` and `src/app/workshop/_components/workshop-ui.ts:55` -- Madrid formatting references only; neither owns this story’s full period contract.
- `src/components/DataLoadError.tsx:10`, `src/app/orders/loading.tsx:1`, and `src/ui/components/Tabs.tsx:19` -- reuse failure/loading visual language; create semantic phone tabs because `Tabs.Item` has no tab semantics.
- `supabase/tests/database/workshop_queue.test.sql:5` and `src/workshop-ui.test.mts:1` -- local pgTAP and Node test conventions.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260922100000_dashboard_workload.sql` -- add idempotent staff-authorized `SECURITY INVOKER` workload read with a fixed search path, explicit role guard, grants/revokes, Madrid boundary resolution, pre-aggregated current-task/delivery inputs, directional rows/day groups/period totals, and no mutation or external call -- make one snapshot authoritative.
- `supabase/tests/database/dashboard_workload.test.sql` -- add pgTAP fixtures for direct role denial, eligibility, independent outgoing/incoming membership, zero/current/history/partner task scope, lifecycle counts, missing identity, delivery precedence, fan-out protection, and large-result completeness -- verify the database boundary.
- `src/lib/dashboard/period.ts` and `src/dashboard-period.test.mts` -- define validated URL parsing, preset/date resolution, URL-preserving href construction, Madrid display data, and tests for rollover, both DST changes, malformed/reversed ranges, and `order` preservation -- give page and SQL inputs one tested contract.
- `src/lib/dashboard/workload.ts` -- call and runtime-validate the RPC with the authenticated server client, returning typed safe fallback data plus `error` -- keep DTO mapping and failures outside page rendering.
- `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/loading.tsx`, and `src/app/dashboard/_components/DashboardWorkload.tsx` -- implement protected staff shell, one shared drawer host, server URL loading, skeleton/error/empty states, summary, chronological day groups, side-by-side desktop lists, and a keyboard-operable phone tablist -- make the workload usable without stale rows or hover-only content.
- `src/ui/layouts/nav-config.ts`, `src/utils/auth/postLogin.ts`, `src/utils/auth/safe-internal-next.ts`, and their focused Node tests -- put Dashboard first, default all staff roles to Dashboard Today, retain valid internal next paths, and reject malformed/external paths to the role default -- preserve safe login and partner/pending routing.
- `src/lib/orders.ts` and `src/components/orders/OrderDetailsDrawer.tsx` -- extend selected-order delivery data and presentation with the same address/maps precedence and safe link/address treatment as the workload -- prevent contradictory dashboard and drawer information.

**Acceptance Criteria:**
- Given an admin, manager, or mechanic without a valid internal destination, when root/password/OAuth landing resolves, then Dashboard Today is first in staff navigation; partners, pending users, and anonymous users retain their current routing and cannot read workload data directly.
- Given each preset or a valid custom range, when the dashboard loads or its period URL changes, then outgoing/incoming rows, day groups, totals, labels, and reference time share Madrid boundaries; malformed/reversed input shows a correctable error and never runs an unbounded query.
- Given qualifying and excluded orders plus repeated task-related joins, when the RPC runs under the caller’s RLS, then only reserved/started/stopped qualify independently by `starts_at` and `stops_at`, rows/totals agree without fan-out, and no client/server business aggregation or per-row detail request occurs.
- Given current, closed, cancelled, completed, partner, and zero-task cases, when readiness renders, then every current task counts once; ready is only `ready_for_pickup`; preparation and later lifecycle counts are explicit; zero tasks reads “No Workshop tasks” without an all-ready claim.
- Given missing customer/number or selected delivery input variants, when an eligible row or drawer renders, then it remains selectable by local UUID, displays explicit identity fallback, and uses identical delivery-address/maps-link/missing semantics in SQL and UI.
- Given tablet/laptop or phone use, when staff scan or switch direction, then both lists are side by side above mobile, the phone uses an accessible two-label tablist below it, date state persists, and switching does not start sync.
- Given a displayed row, when its order action, Escape, close control, Back, or Forward is used, then the existing drawer alone fetches that selected order and preserves all non-`order` URL parameters, focus, and distinct loading/not-found/error states.

## Design Notes

Use `/dashboard` consistently as the canonical staff route. An invalid `next` cannot be preserved as an explicit valid internal destination, so it resolves to the trusted role default. Treat unknown fulfillment as evidence absence, never as pickup or delivery. Story 1.1 shows existing sync evidence only when it has proven scope; otherwise it states “Sync confidence unavailable.”

## Verification

**Commands:**
- `npm run test:db` -- expected: dashboard pgTAP tests and existing database suite pass against the local stack.
- `npm run test:dashboard && npm run test:trusted-role-assignment && npm run test:pending-layout` -- expected: period, delivery, navigation, landing, and pending behavior pass.
- `npm run lint` -- expected: no lint errors.
- `npx tsc --noEmit` -- expected: type-check completes without errors.

**Manual checks:**
- Sign in as each staff role and inspect Dashboard Today, explicit internal `next`, partner/pending denial, drawer history, failure versus empty state, keyboard phone tabs, and tablet/phone/zoom reflow.
- Apply and replay the migration locally; capture an `EXPLAIN`/response/useful-view baseline for representative Today, month, and custom fixtures without claiming Q14 rollout targets.

## Review Triage Log

- **Resolved (11):** Corrected stale custom-date input defaults, tab focus movement, runtime DTO validation, pickup delivery display, invalid-period controls, production error copy, touch targets, delivery provenance, login callback-error handling, direct role/incoming SQL coverage, and a reusable dashboard test command.
- **Deferred (2):** Browser-level responsive/auth/drawer interaction evidence and representative query-plan/performance evidence remain release checks. No browser runner or representative operational fixture is available in this local implementation pass.
- **Rejected (2):** A user-visible custom-range cap conflicts with the approved contract, and an incoming-deliveries summary conflicts with the approved outgoing-only delivery measure.
- **Follow-up review:** Recommended. Residual score is 6 (two medium verification gaps); implementation defects found in this review are resolved.

## Auto Run Result

Implemented Story 1.1 as a staff-only `/dashboard` landing route. A single local PostgreSQL `dashboard_workload` RPC owns Madrid date membership, order/task aggregation, day groups, totals, direct role authorization, and delivery precedence. The page retains URL-owned period and selected-order state, reuses the existing drawer, and preserves safe role routing.

Verification passed: `npm run test:db` (8 files, 535 tests), `npm run test:dashboard` (10 tests), `npm run test:trusted-role-assignment`, `npm run test:pending-layout`, `npx tsc --noEmit`, focused ESLint (no errors), and `git diff --check`. The focused lint command still reports four pre-existing image warnings in `LoginForm`; the repository-wide lint command has pre-existing unrelated errors and is not a clean global gate.

No hosted database, provider, deployment, or production action was taken. The migration was revised and reapplied only to the local Supabase database under the explicit authorization to amend this un-deployed migration.
