---
title: 'Story 1.2: Identify preparation priorities and open the relevant Workshop task'
type: feature
created: '2026-09-23'
status: done
baseline_revision: 'ac436135b45869f57f89559eccd9dd6d5aff3c24'
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

**Problem:** The reviewed Dashboard shows factual workload but does not make today's preparation risk clear or let staff move from an order to its current bike tasks.

**Approach:** Extend the coherent workload read with evidence-backed, prioritized conditions, and load staff-only current task links when the existing shared order drawer opens.

## Boundaries & Constraints

**Always:** Use the same Madrid reference instant and current-task predicate as Story 1.1. For outgoing orders scheduled today in any selected range, preparation outstanding at >6h has low emphasis, >2h through 6h is warning, and <=2h including overdue is critical. Report actual outstanding bike counts. Show missing delivery data in all periods, prominent Tomorrow and high priority Today. Deduplicate by order/task and condition; retain distinct conditions and chronological rows. The drawer task read must authorize staff directly, use caller RLS, and fetch only the selected order.

**Block If:** Current source/configuration fields cannot support a proposed notice without actual evidence, or task identity cannot be presented safely under the existing staff RLS contract. Omit unsupported diagnoses rather than infer them from `needs_recheck` alone.

**Never:** Mutate orders/tasks or start sync on read; claim booked-unit mismatch or cross-order turnaround risk; add row-by-row detail requests, a second drawer, historical task browser, direct Dashboard task edits, or partner access to Workshop data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Boundary urgency | Today's outgoing prep at >6h, 6h, >2h, 2h, overdue | Low, warning, warning, critical, critical using workload reference instant | No escalation for tomorrow, incoming, zero-task or later lifecycle rows |
| Mixed tasks | 10 ready and 2 preparation tasks; returned/storage/completed mixed in | Text says 2 bikes still to prepare; later lifecycle is not preparation failure | No inferred booked-unit gap |
| Delivery/evidence | Missing destination, configuration warning, source notice | Distinct evidenced conditions, deduplicated and severity ordered; Today missing address high, Tomorrow prominent | No allocation-change claim from `needs_recheck` alone |
| Drawer task links | Staff opens selected order with current, partner, completed, closed and cancelled tasks | Only current non-cancelled rental tasks show bike identity/status and existing Workshop links | Read failure is explicit, separate from no tasks; partner/pending/anonymous direct calls denied |

</intent-contract>

## Code Map

- `supabase/migrations/20260922100000_dashboard_workload.sql:6` -- reviewed SECURITY INVOKER staff RPC and Madrid bounds; preserve this predicate and one-snapshot JSON structure.
- `supabase/migrations/20260922100000_dashboard_workload.sql:67` -- open assignment, `rental_turnaround`, non-cancelled current task aggregation; extend independently without join fan-out.
- `supabase/migrations/20260821120000_workshop_foundation.sql:101` -- bike task status, identity, and configuration warning fields; staff task RLS near line 1572.
- `supabase/migrations/20260917124408_workshop_booqable_order_status_sync.sql:486` -- existing source notice evidence function; inspect semantics before reuse and do not expose its SECURITY DEFINER implementation through an unrestricted read.
- `src/lib/dashboard/workload.ts:4` -- runtime validated JSON payload and loader; extend type/validation in lockstep with SQL.
- `src/app/dashboard/_components/DashboardWorkload.tsx:76` -- chronological row UI and `Open order`; add factual row conditions and a concise attention summary without reordering lists.
- `src/components/orders/OrderDetailsDrawerHost.tsx:21` -- only selected order is fetched on open; load current task links separately with cancellation-safe state.
- `src/components/orders/OrderDetailsDrawer.tsx:419` -- shared drawer placement for links and explicit loading/error/empty states; preserve focus, history and partner order access.
- `src/app/workshop/[taskId]/page.tsx:9` -- existing Workshop destination and permission/error behavior.
- `supabase/tests/database/dashboard_workload.test.sql:80` and `src/dashboard-ui.test.mts:9` -- current SQL and UI test seams; extend with Story 1.2 cases.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260923102444_dashboard_priorities_and_task_links.sql` -- idempotently replace the workload RPC with SQL-owned urgency and evidenced conditions, and add a staff-authorized selected-order current-task read sharing the exact task predicate -- keep both data boundaries coherent.
- `supabase/tests/database/dashboard_workload.test.sql` -- test exact reference-time thresholds, date/lifecycle exclusions, actual counts, evidence and deduplication, direct role denial, selected-order task scope and no read mutation -- protect the database behavior.
- `src/lib/dashboard/workload.ts` -- type and validate the new workload fields -- reject malformed payloads visibly.
- `src/app/dashboard/_components/DashboardWorkload.tsx` and `src/app/dashboard/_components/DashboardWorkload.module.css` -- display concise attention above unchanged chronological lists and accessible text notices with named severity and affected counts -- make preparation actionable.
- `src/lib/orders/actions/current-task-actions.ts` -- add a `withAuth` staff-only selected-order action returning `{ tasks, error }` with a safe empty fallback -- deny direct nonstaff calls and distinguish failure from no tasks.
- `src/components/orders/OrderDetailsDrawerHost.tsx` and `src/components/orders/OrderDetailsDrawer.tsx` -- load links only when an order is selected, handle stale requests and loading/error/empty separately, and link current bike identity/status to `/workshop/[taskId]` -- complete the existing order journey.
- `src/dashboard-ui.test.mts` and `src/dashboard-task-links.test.mts` -- cover attention, text severity, actual affected count, selected-order loading/denial and failure states -- verify the outer UI/action surfaces.

**Acceptance Criteria:**
- Given a selected range that includes today, when authorized staff load the Dashboard, then today's outgoing rows use the exact 6h/2h preparation thresholds from the returned reference instant, while other dates and later lifecycle rows remain informational.
- Given current preparation, ready, later lifecycle and zero-task orders, when staff scan attention and rows, then affected bike counts are exact, zero tasks do not become urgency, distinct evidenced notices remain, and chronological order remains intact.
- Given a staff member opens an order, when current task links load, then only current non-cancelled bike tasks with identity/status reach existing Workshop screens, with a visible error on failure and no per-row prefetch.
- Given partner, pending or anonymous direct callers, when they request selected-order task links, then the boundary denies access even if partner order details are otherwise visible; no staff task data is returned.
- Given keyboard, touch or browser history navigation, when staff move Dashboard → drawer → Workshop or close the drawer, then the existing focus, URL period and order history behavior remains usable and notices do not rely on color alone.

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 2, medium 6, low 1)
- defer: 0
- reject: 3 (medium 1, low 2)
- addressed_findings:
  - `[high]` `[patch]` Apply preparation urgency to every eligible outgoing row with actual outstanding preparation, including started/stopped orders.
  - `[high]` `[patch]` Preserve all six evidenced Workshop source notices with task-level precedence and direct database tests.
  - `[medium]` `[patch]` Restrict missing delivery priority to outgoing rows.
  - `[medium]` `[patch]` Sort each row's distinct conditions by severity without changing chronological order.
  - `[medium]` `[patch]` Use singular affected-bike wording and distinct text-plus-visual notice emphasis.
  - `[medium]` `[patch]` Skip selected-order task requests in the shared drawer until a staff role is known.
  - `[medium]` `[patch]` Strengthen zero-task, attention deduplication, and read-only database assertions.
  - `[medium]` `[patch]` Render notices and task-link loading/error/empty/list states in tests instead of relying only on source-text checks.
  - `[low]` `[patch]` Show a stable task ID when bike display identities collide.

## Auto Run Result

Story 1.2 adds Madrid-reference preparation urgency, evidenced and severity-ordered notices, exact affected-bike counts, and concise attention above the chronological Dashboard lists. The shared order drawer loads current bike tasks only for the selected staff order and links them to existing Workshop screens; the direct database and action boundaries also deny nonstaff access.

Files changed: `supabase/migrations/20260923102444_dashboard_priorities_and_task_links.sql` adds idempotent workload and selected-task reads; `supabase/tests/database/dashboard_workload.test.sql` verifies urgency, source evidence, role/scope, deduplication and read-only behavior; `src/lib/dashboard/workload.ts` validates the expanded payload; `src/app/dashboard/_components/DashboardWorkload.tsx`, `DashboardWorkload.module.css` and `DashboardNotices.tsx` render attention and row notices; `src/lib/orders/actions/current-task-actions.ts`, `src/components/orders/OrderDetailsDrawerHost.tsx`, `OrderDetailsDrawer.tsx` and `CurrentWorkshopTaskList.tsx` add the staff-only selected-order task journey; `src/dashboard-ui.test.mts`, `src/dashboard-task-links.test.mts` and `package.json` register and run focused Dashboard tests.

Review: 9 patches applied (high 2, medium 6, low 1); 0 deferred; 3 rejected as outside the approved Story 1.2 outcome or unsupported by evidence. Follow-up review recommended: true; patched medium/low score is 19 (the high findings also trigger the recommendation).

Verification: `npm run test:db` passed 571 local tests; `npm run test:dashboard` passed 13 tests; `npx tsc --noEmit`, scoped ESLint on changed source files and `git diff --check` passed. The repository-wide `npm run lint` still fails on pre-existing unrelated files (16 errors and 22 warnings). The migration was applied and replayed only against the local Supabase stack. A direct anonymous pgTAP invocation crashed local Postgres during implementation; it recovered, the direct call was replaced with an anonymous execute-grant check, and the full local suite passes. Authenticated browser, device, focus/history, and scan-time checks have not been run in this iteration; they remain the practical limit on UX verification. No hosted database, provider, deployment, or production action was taken.

## Verification

**Commands:**
- `npm run test:db` -- expected: local pgTAP suite covers threshold, evidence, role and task-scope fixtures.
- `npm run test:dashboard` -- expected: Dashboard and task-link UI tests pass.
- `npx tsc --noEmit` and `npm run lint` -- expected: no new type or lint errors.
- `git diff --check` -- expected: clean patch formatting.

**Manual checks:**
- In an authenticated browser, inspect Today/Next 7 Days/custom attention and Dashboard → drawer → Workshop with keyboard/touch, missing task read, role denial and phone/tablet/zoom layout. Record device and timing context for 10-second workload and 30-second priority scan goals.
- Apply and replay the migration locally; confirm reads leave source/order/task state unchanged. Do not treat local evidence as hosted rollout verification.
