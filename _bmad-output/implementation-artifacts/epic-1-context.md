# Epic 1 Context: Plan and run daily rental operations from one dashboard

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give authorized staff one selected-period view of departures, returns, bike preparation, and delivery information. They can identify immediate work, open the existing order and Workshop journeys, and explicitly refresh source data with accurate progress and recovery. The dashboard reduces routine comparison of Booqable and Workshop while preserving their established permissions and workflows.

## Stories

- Story 1.1: Browse the rental workload and readiness dashboard
- Story 1.2: Identify preparation priorities and open the relevant Workshop task
- Story 1.3: See approximate driving time for deliveries
- Story 1.4: Refresh the selected period and recover interrupted syncs

## Requirements & Constraints

- Admin, manager, and mechanic land on Dashboard Today unless a valid internal destination was supplied. Dashboard leads staff navigation; partner, pending, and anonymous callers cannot access its data directly.
- One URL-owned period controls both directions and totals. Support Today, Tomorrow, Next 7 Days, the following Monday–Sunday, the next complete calendar month, and inclusive custom dates. Use Europe/Madrid dates and DST-safe bounds; reject malformed or reversed ranges explicitly.
- Show chronological Going out and Coming back rows grouped by Madrid day, with coherent period and day totals. Include reserved, started, and stopped orders by scheduled start or return independently; exclude new, draft, cancelled, and archived. An order may occur in both directions. Missing customer or order number must not erase an otherwise eligible row.
- Count current non-cancelled rental-turnaround tasks on open assignment instances, including completed tasks while current. Keep partner units separate; exclude retained history, checklists, and add-ons. Outgoing preparation means to_prepare, being_prepared, and needs_recheck. Zero current tasks reads “No Workshop tasks” without invented missing units or urgency.
- Resolve delivery destination from nonblank delivery_address, then nonblank maps_link_order. Do not use billing or customer addresses. Absent input reads “Delivery address missing”; supplied but unroutable input remains visible and is not counted as missing.
- Apply preparation urgency only to today's outgoing work using the workload reference instant and the approved six-hour and two-hour thresholds. Derive attention from actual evidence; notices and dashboard reads never mutate orders, tasks, or Booqable data.
- Keep core workload usable when optional routing or sync fails. Distinguish empty results, invalid dates, failed loads, missing detail, unavailable ETA, and incomplete refresh. Preserve existing Orders, Workshop, and guarded whole-order pickup/return behavior.

## Technical Decisions

- One staff-authorized SECURITY INVOKER PostgreSQL read under RLS owns workload selection, grouping, task denominators, and totals. Pre-aggregate inputs to avoid join fan-out; do not calculate workload totals in Node or the client, issue per-row detail reads, or silently truncate results.
- Capture one reference instant for calendar membership, labels, and urgency. Replace period dates, rows, totals, and derived status coherently on revalidation.
- Enforce trusted role authorization at workload, selected-task, ETA, and sync start/resume boundaries. Use user RLS clients for dashboard and drawer reads. The existing service-role exception applies only to authorized backend reconciliation.
- Reuse the shared order drawer with `?order=<local UUID>`, its history and focus behavior, and existing Workshop task routes. Load task links only for the selected authorized order, using the same current-task predicate as the workload.
- Keep Google Routes estimates separate from the core read. Server-authorize the order, reread its destination, send only necessary route inputs, bound work, and discard estimates when their inputs no longer match. Unsupported or failed routes show “Drive time unavailable.”
- Extend the existing manual sync worker, reconciliation, leases/fences, complete-snapshot validation, and environment gate. Selected-period runs save versioned scope, exact Madrid interval bounds, policy, discovery checkpoints, and per-order outcomes. Resume the saved server interval; client navigation and midnight cannot widen or recalculate it. Success requires complete discovery and every required reconciliation. Legacy reserved-only runs retain their original meaning. Use bounded awaited requests, without a scheduler, detached work, or a second engine.
- Any migration is idempotent and verified locally. Preserve readable legacy run state or an explicit restart path. Remote migration and deployment follow branch CI and are outside this implementation authorization.

## UX & Interaction Patterns

- Reuse Echelon Subframe styling and components. Place shared period and sync controls before the workload summary, concise attention, and directional lists. Keep lists dominant, with no new chart or financial dashboard.
- Show both directions side by side on tablet/laptop. Phones use visible Going out and Coming back labels above one accessible active list. Switching direction preserves the period and does not trigger sync. Keep essential row details readable under wrapping and zoom.
- An explicit order action opens the shared drawer; current bike-task links there lead to existing Workshop screens. Preserve URL state, Back/Forward, Escape, drawer focus containment, and focus return. Do not add direct task editing to dashboard rows.
- Show sync progress, result, errors, and resume/restart in the same language and component patterns as Workshop. Keep workload visible while refresh advances or pauses. Show the saved run's dates when relevant; do not combine one run's result with another run's timestamp or claim wider coverage. Do not introduce a separate confidence status.
- Use skeletons during cold load, visible errors and date correction, text-based statuses, semantic headings and lists, labeled controls, visible focus, keyboard/touch access, and restrained announcements. Verify tablet, phone, zoom, contrast, and reduced-motion behavior in rendered UI.

## Cross-Story Dependencies

Story 1.1 provides the staff landing, shared period, coherent workload read, destination display, responsive lists, and order opening. Story 1.2 adds evidence-based urgency and current Workshop task navigation. Stories 1.3 and 1.4 each depend on 1.1 but not on each other: routing estimates remain optional, while selected-period refresh extends existing reconciliation. Until 1.4, display only the proven scope of legacy sync evidence and offer no selected-period refresh control. Full rollout requires measured performance acceptance and routing operational checks.
