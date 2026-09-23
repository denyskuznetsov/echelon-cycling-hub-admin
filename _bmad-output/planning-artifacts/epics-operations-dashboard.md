---
title: Operations Dashboard — Epic and Stories
type: epic-breakdown
status: backlog
created: '2026-09-22'
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
currentStep: complete
validation_status: complete-for-backlog
requirementsExtraction: confirmed
epicDesign: complete
workflow_mode: User-directed completion after requesting the agent create the stories without further intermediate checkpoints.
implementation_readiness: Sequential implementation; Q14 and routing readiness remain pre-rollout gates.
workflow: bmad-create-epics-and-stories
scope: One dashboard epic with a small number of cohesive stories
inputDocuments:
  - '_bmad-output/specs/spec-operations-dashboard/SPEC.md'
  - '_bmad-output/specs/spec-operations-dashboard/ARCHITECTURE-SPINE.md'
  - '_bmad-output/specs/spec-operations-dashboard/data-contract.md'
  - '_bmad-output/specs/spec-operations-dashboard/brownfield.md'
  - '_bmad-output/specs/spec-operations-dashboard/verification.md'
  - 'docs/features/operations-dashboard-spec.md'
  - 'docs/features/operations-dashboard-codex-handoff.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-echelon-cycling-hub-admin-2026-09-22/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-echelon-cycling-hub-admin-2026-09-22/EXPERIENCE.md'
  - 'AGENTS.md'
---

# Echelon Operations Dashboard — Epic Breakdown

## Overview

Deliver one operational dashboard epic with a small number of cohesive, usable stories. The owner confirmed the input set on 2026-09-22. This feature document keeps the existing Project Foundations epic separate. Requirements were confirmed; this document now contains one epic and four implementation stories with acceptance criteria and verification ownership.

The canonical [SPEC](../specs/spec-operations-dashboard/SPEC.md), its twelve adopted architecture decisions and explicit verification overrides govern conflicts with the original product/handoff documents. The final UX pair governs composition and interactions. The original Story 0–8 proposal is not an approved decomposition. Product decisions are settled; Q14 performance acceptance and routing readiness remain pre-rollout checks. This document authorizes planning, not implementation or external operations.

## Requirements Inventory

### Functional Requirements

IDs preserve the original product FR mapping while applying the canonical replacements.

- **FR-01 / CAP-1:** Default eligible staff to Dashboard Today in Europe/Madrid when there is no explicit valid internal destination.
- **FR-02 / CAP-2:** Provide Today, Tomorrow, Next 7 Days (today through day +6), Next Week (following Monday–Sunday), Next Month (next complete calendar month) and inclusive custom dates. URL state survives refresh/history/drawer navigation; reject malformed or reversed dates explicitly. Use one captured reference instant and DST-safe local boundaries.
- **FR-03 / CAP-3:** Return coherent order rows, day groups and period totals for outgoing orders/bikes, incoming orders/bikes, outgoing deliveries, outstanding preparation and missing-address deliveries. Include reserved/started/stopped by scheduled start/return independently; exclude new/draft/canceled/archived. An order can appear once in each direction. Missing customer/number and zero-task orders remain eligible; missing timestamps cannot qualify that direction.
- **FR-04 / CAP-3:** Display chronological Going out and Coming back lists, grouped by Madrid calendar day for multi-day periods, with schedule, customer/reference, bikes and relevant lifecycle context. Preserve eligible rows with explicit missing identity text, including “Booqable order number missing.”
- **FR-05 / CAP-3:** Show pickup/delivery/unknown fulfillment without inventing separate lifecycles; show incoming collection context only where reliable. Keep financial details in the shared drawer.
- **FR-06 / CAP-4:** Use current rental_turnaround tasks on open assignment instances, excluding cancelled tasks and retaining completed tasks while current. Only ready_for_pickup is ready; outstanding preparation is to_prepare + being_prepared + needs_recheck for selected-period outgoing orders. Show exact mixed-lifecycle counts, distinguishing in_rental, returned, prepare_for_storage and completed; do not count later lifecycle as preparation failure.
- **FR-07 / CAP-4, canonical replacement:** Use current task scope for every bike denominator and task link; preserve separate partner units and exclude retained history/checklists/add-ons. Seven current ready tasks may show 7/7 despite eight booked units. Zero tasks yields a consistent “No Workshop tasks” highlight in both directions and all periods, without invented missing units, all-ready claims or urgency escalation. Independent booked-unit mismatch auditing is excluded.
- **FR-08 / CAP-5:** Resolve delivery destination as nonblank delivery_address, otherwise nonblank maps_link_order, preserving supplied value, provenance and address/link form. Whitespace is empty; billing/customer addresses are never fallbacks. Apply the same rule in SQL counts and shared order display.
- **FR-09 / CAP-5:** When both delivery inputs are absent, show “Delivery address missing” and count it in every timeframe, prominent Tomorrow and high priority Today. Supplied but unroutable input remains supplied and does not count as missing.
- **FR-10 / CAP-5:** Independently load approximate shop-to-destination Google Routes v2 DRIVE/TRAFFIC_UNAWARE durations with Google Maps attribution. Preserve destination and show “Drive time unavailable” on unsupported, ambiguous, failed, quota or timeout outcomes. Display estimates only against their matching current inputs.
- **FR-11 / CAP-6:** In every selected range, apply preparation urgency only to outgoing rows starting today in Madrid: >6h low emphasis; >2h and <=6h warning; <=2h including overdue critical. Use named thresholds and the workload reference instant. Other dates, later lifecycle tasks and zero-task highlights do not receive preparation urgency.
- **FR-12 / CAP-7:** One order action opens the existing shared drawer using the local UUID; preserve period, unrelated URL parameters, history and focus. Fetch details only for the selected order.
- **FR-13 / CAP-7:** Extend the shared drawer with on-demand, staff-authorized current bike-task links, using the same scope as counts and showing bike identity/status. Reach existing Workshop task screens; exclude historical tasks and do not expose staff task data to partners.
- **FR-14 / CAP-8:** Extend existing reconciliation to explicit selected-period start OR return discovery plus locally eligible in-window candidates captured at run start. Deduplicate source IDs and re-fetch captured candidates after source cancellation/date movement. Persist versioned scope, exact dates/bounds, policy, discovery progress and per-order outcomes. Resume the saved server interval after navigation/midnight; show progress while workload remains usable. Success requires complete enumeration and all required reconciliations. Keep failed/incomplete/stale/unknown/empty states and legacy reserved-only evidence distinct, with truthful same-run labels and recovery. Retries replace outcomes; skipped/deleted/unavailable candidates cannot become successful refreshes.
- **FR-15 / CAP-6:** Show plain-language, evidence-based configuration/source notices with affected counts where known. Deduplicate identical order/task conditions, retain distinct issues and highest severity first while keeping timelines chronological. Reads and warnings never mutate tasks, orders or Booqable; needs_recheck alone is not an allocation-change diagnosis. Cross-order tight-turnaround prediction is excluded.
- **FR-16 / CAP-1:** Put Dashboard first in admin/manager/mechanic navigation and retain Workshop and existing items. Preserve explicit valid login destinations and partner/pending handling; deny partner/pending/anonymous direct dashboard access.

### NonFunctional Requirements

- **NFR-1 — Authorization:** Enforce trusted staff roles at workload RPC, selected-task, ETA and sync start/resume boundaries, not just navigation. Dashboard/drawer use user RLS clients; preserve existing financial/customer/partner permissions. Denied routing calls make no provider request.
- **NFR-2 — Consistency and performance:** PostgreSQL owns aggregation and cross-table selection through one coherent read result; no client aggregation, per-row detail requests, join fan-out or silent truncation. Any future pagination preserves whole-period totals and identifies partial delivery. No unapproved user-visible date-range cap.
- **NFR-3 — Calendar integrity:** Madrid membership, labels and urgency share one reference instant; replace them coherently on revalidation. Independently convert local day boundaries across DST; persist resolved sync bounds independently of current URL/time.
- **NFR-4 — Reliability and errors:** Optional routing cannot delay/erase core workload. Loaders return safe data plus explicit error; distinguish empty, failed, missing detail and expired session. Actions use withAuth and result values for expected failures; use visible Alert errors and contextual sanitized logs.
- **NFR-5 — Provider privacy and bounded execution:** Server-authorize local order IDs and reread destination inputs; send only required origin/destination/routing parameters. No arbitrary routing proxy, client secret, customer identity or full delivery payload in logs. Bound timeouts, concurrency and response size; no retry loop, polling, persistent/cross-request ETA cache or drawer-only ETA refetch. Deduplicate within each load.
- **NFR-6 — Accessibility:** Keyboard/touch operation, semantic labels/headings, visible focus, drawer focus containment/return, non-color status, reflow/zoom and reduced-motion feedback. Target 44px primary controls, 4.5:1 normal text contrast and 3:1 large text/control/focus contrast; verify rendered behavior.
- **NFR-7 — Responsive scanability:** Support Windows tablet/laptop first, smartphone second and other laptops. With representative fixtures, understand workload/critical issues in under 10 seconds and preparation priorities in under 30 seconds. These are usability goals, not network-latency targets.
- **NFR-8 — Compatibility:** Reuse shared drawer, Workshop task screens, assignments, partner units, history, leases and complete-snapshot reconciliation. Preserve guarded whole-order pickup/return effects without per-bike fulfillment, backward transitions or missed-stage replay. Keep existing runtime and environment sync gates.
- **NFR-9 — Migration and rollback:** Any future schema change is idempotent, locally verified and delivered remotely via branch CI. Keep legacy scopes/cursors readable or explicitly restartable. Rollback restores prior landing/navigation and disables new routing/selected-period entry points without deleting source/task history or breaking Orders/Workshop.
- **NFR-10 — Verification and rollout:** Cover all eleven reconciled product scenarios plus the architecture acceptance matrix with appropriate database, integration and browser evidence. Measure query plans/time, server response, usable workload and selected-period throughput over Today/month/custom volumes on actual staff devices; agree Q14 targets before rollout. Verify routing origin, supported real URL fixtures, ambiguity, credentials, terms/privacy, attribution and quotas before enabling estimates.

### Additional Requirements

- **AR-1 / AD-1–5:** One staff-authorized SECURITY INVOKER PostgreSQL read function under RLS owns rows/day/period totals from independently pre-aggregated inputs. Keep routing, sync and mutations outside it. Return validated dates/reference instant. SQL/DTO names are implementation choices; revalidate dated brownfield schema evidence at pickup.
- **AR-2 / AD-7:** Extend existing nav-config, shared postLogin handling, OrderDetailsDrawerHost/useOpenOrderDetails and selected-order loaders. Reuse ?order=<local UUID>; do not mount another order-details implementation. Later drawer reads must not overwrite the coherent workload snapshot with their counts.
- **AR-3 / AD-8–9:** Add shared destination precedence with SQL/display parity fixtures and a separate Google adapter. BUSINESS_ADDRESS seeds the origin; verify its exact location. Only tested destination-bearing inputs qualify; viewport coordinates are not destinations. No Maps HTML scraping. If short-link expansion is implemented, allowlist HTTPS Google Maps hosts at every redirect, reject private-network destinations, and bound redirects/response size. Unsupported/ambiguous input remains visible as a safe link with ETA unavailable.
- **AR-4 / AD-10–11:** Extend existing run/worker infrastructure with durable versioned selected-period scope and bounded awaited request work. Preserve leases/fences, complete snapshots and recovery. A client cursor cannot widen saved scope; navigation may pause advancement. No scheduler, detached promise, second worker system or unapproved sync optimization redesign.
- **AR-5 / AD-12:** The recorded service-role exception is limited to existing backend reconciliation after staff authorization, including resume; it does not authorize privileged workload/drawer reads or live configuration changes. Preserve workshopSyncAllowed.
- **AR-6:** Reuse existing Subframe components and current test/fixture infrastructure. No greenfield starter, dependency upgrade, new backend, feature-flag platform or design system. Generated types or equivalent validated contracts must reflect future schema changes; do not assume existing generated types.
- **AR-7:** Planning does not authorize deployment, tenant reads/writes or provider setup. Q14 and routing operational checks are rollout gates, not new product-discovery stories. Keep test ownership with the capability it verifies rather than creating artificial infrastructure-only increments.
- **AR-8 — Scope exclusions:** No booked-unit completeness audit, cross-order turnaround prediction, historic-task browser, new return workflow, automated large-group alarm, delivery assignment/dispatch/route optimization/live traffic, customer messaging/address editor, Booqable write-back, automatic substitutions, duplicate detail/task UI, analytics, AI notes interpretation or rider mapping.

### UX Design Requirements

- **UX-DR1 — Shell and hierarchy:** Inherit Echelon Subframe colors, Geist typography, spacing, radii and overlays without new tokens. Order header/shared period/sync → workload summary → concise attention → directional lists. Keep lists dominant; no new chart/financial dashboard.
- **UX-DR2 — Shared period control:** One labeled Select/Calendar/Button composition updates both directions and summary, displaying resolved dates. Default Today; support all presets and inclusive custom range; show correctable inline date validation and preserve URL/history state.
- **UX-DR3 — Sync presentation:** Reuse Workshop Button/Progress/Alert patterns and plain-language in-progress, success and error messages for explicit refresh, scope and resume/restart. Keep lists usable; show the saved run date range when relevant and explain environment unavailability. Do not introduce a separate “confidence” status or success vocabulary; expose run evidence only through consistent progress, result and error details.
- **UX-DR4 — Summary and attention:** Show both directional order/bike totals, outgoing deliveries, outstanding preparation and missing-address counts from the coherent result. Summarize actual deduplicated row issues without repeated large alert cards or reordering chronological lists.
- **UX-DR5 — Responsive direction control:** Side-by-side Going out/Coming back on tablet/laptop. Phones show two visible direction labels above one active list, with accessible tablist, selected state, keyboard movement and labeled panel. Switching direction preserves period and does not start sync.
- **UX-DR6 — Day headings and rows:** Align times, separate multi-day groups with Madrid dates and day counts, and wrap rather than shrink essential content. Outgoing rows show identity, fulfillment, readiness/lifecycle, delivery details, warnings and useful relative start time today; incoming rows show return time, identity, bikes/lifecycle and reliable collection context.
- **UX-DR7 — Readiness/status:** Use ready/total only for preparation/ready-only orders; otherwise named exact lifecycle counts, separately returned versus storage in progress. Use consistent “No Workshop tasks” highlighting across dates/directions and explicit missing-name/number text. Status never relies on color/hover.
- **UX-DR8 — Delivery details:** Keep supplied destination readable using existing text/link styles; show independent estimate loading, “Approx.” duration and attribution, or “Drive time unavailable.” Missing destination is explicitly “Delivery address missing.” Never show a late estimate beside changed destination inputs.
- **UX-DR9 — Order action and drawer:** Provide one explicit focusable order-opening action for touch/keyboard. Reuse drawer skeleton, focus containment/Escape/return and URL behavior. Load current bike identity/status links only for selected authorized detail; task-link errors must not resemble no tasks.
- **UX-DR10 — Workshop navigation:** Reach existing /workshop/[taskId] through the shared drawer and preserve current screen actions/loading/error behavior. No direct dashboard task-edit controls or substitute workflow.
- **UX-DR11 — Feedback states:** Cold load uses skeletons, not placeholder zeros. Period changes never label old rows with new dates; replace counts/rows/labels/urgency together. Differentiate directional empty, workload failure, invalid range, missing detail, detail failure and optional ETA failure. Preserve usable controls and navigation; do not promise offline or queued writes.
- **UX-DR12 — Accessibility verification:** Use semantic headings/lists/date groups, labels, logical focus order and announced loading/result/errors without repeated interruptions. Verify focus, selected/disabled states, text zoom/reflow, reduced motion, touch targets and contrast against NFR-6.
- **UX-DR13 — Reference fidelity and device verification:** Follow finalized tablet/phone references for composition, with one shared period. Existing mobile <=767px is a starting point, not proven device fit. Verify actual Windows viewport, portrait tablet and phone density; preserve both directions and essential data under zoom. Do not import Booqable sidebar/colors/avatars, extra filters, reports or late-only views.

### FR Coverage Map

| Requirement | Epic | Outcome |
|---|---|---|
| FR-01 | Dashboard Epic 1 | Staff start on Today. |
| FR-02 | Dashboard Epic 1 | Shared Madrid period survives navigation. |
| FR-03 | Dashboard Epic 1 | Coherent workload and preparation totals. |
| FR-04 | Dashboard Epic 1 | Chronological outgoing/incoming day lists. |
| FR-05 | Dashboard Epic 1 | Clear fulfillment and reliable collection context. |
| FR-06 | Dashboard Epic 1 | Accurate readiness and lifecycle breakdown. |
| FR-07 | Dashboard Epic 1 | Current-task counts and honest zero-task state. |
| FR-08 | Dashboard Epic 1 | Consistent supplied delivery destination. |
| FR-09 | Dashboard Epic 1 | Missing delivery details visible in every period. |
| FR-10 | Dashboard Epic 1 | Independent approximate delivery drive time. |
| FR-11 | Dashboard Epic 1 | Appropriate urgency for today's departures. |
| FR-12 | Dashboard Epic 1 | One-action shared order detail. |
| FR-13 | Dashboard Epic 1 | Current bike tasks reachable through the drawer. |
| FR-14 | Dashboard Epic 1 | Selected-period synchronization and recovery. |
| FR-15 | Dashboard Epic 1 | Deterministic evidence-based attention. |
| FR-16 | Dashboard Epic 1 | Staff navigation with preserved role boundaries. |

All NFR-1–10, AR-1–8 and UX-DR1–13 apply within this epic. Story-level coverage and verification ownership appear below.

## Epic List

### Dashboard Epic 1: Plan and run daily rental operations from one dashboard

Admin, manager and mechanic can start their day with a trustworthy selected-period view of departures, returns, bike preparation and delivery logistics; identify today's actionable risks; open an order and its current Workshop tasks; and explicitly refresh the selected period with honest progress and recovery.

**FRs covered:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16. **Capabilities:** CAP-1–8.

**User outcome:** Staff can plan and execute routine rental work from Echelon without manually comparing Booqable and Workshop for each order. The dashboard supports the approved tablet/laptop and phone journeys, preserves existing task workflows and reports sync progress and errors consistently with Workshop.

**Boundary and dependencies:** One complete dashboard epic, using existing Orders, Workshop, authentication and reconciliation infrastructure. It does not depend on completing the separate Project Foundations backlog or sync-optimization research. Revalidate existing extension seams during implementation. Routing configuration and Q14 measured performance acceptance gate rollout; they do not require extra epics.

**Compact delivery approach:** Keep database, server, UI and relevant tests together around usable staff outcomes. Extend shared components once where practical; avoid separate shell-only, database-only, warning-engine-only or test-only stories. Later increments may build on earlier delivered functionality, but no story may require an unfinished future story to work. The four stories below each own one coherent delivery scope; implementation subtasks stay within those stories.

**Completion boundary:** All eight capabilities, the finalized UX and the reconciled acceptance/architecture matrix are covered; staff permissions, Orders/Workshop behavior and legacy sync meaning remain intact. Performance and routing rollout evidence is recorded before release. Epic completion does not itself authorize hosted migration, provider configuration or deployment.

## Epic 1: Plan and run daily rental operations from one dashboard

Staff can understand the selected rental workload, act through existing order/task screens, organize deliveries and refresh the selected period from a single operational starting point.

### Delivery sequence and scope

| Story | Usable outcome | Depends on |
|---|---|---|
| 1.1 Workload dashboard | Staff browse real local workload, readiness and delivery destinations for any approved period and open orders. | Existing application only |
| 1.2 Preparation priorities and Workshop navigation | Staff identify today's preparation risks and reach the relevant bike task through an order. | 1.1 |
| 1.3 Delivery drive estimates | Staff see approximate drive duration without disrupting workload. | 1.1 |
| 1.4 Selected-period sync and recovery | Staff refresh outgoing/incoming source data for the chosen dates and resume or recover incomplete runs. | 1.1 |

Implement sequentially in the listed order. Stories 1.3 and 1.4 do not require one another's provider integration. Each includes its own necessary SQL/server/UI work and tests; no separate setup, discovery or testing story. Story 1.1 is the largest but stays within the local read-and-display boundary. Story 1.4 is the other substantial increment, confined to extending existing sync infrastructure and its dashboard controls. Only create database objects when the owning story needs them.

Before 1.4, show existing sync evidence only with its proven legacy scope using Workshop-consistent progress/result/error language; do not offer a nonfunctional selected-period refresh. Before 1.3, display destinations without an estimate or fake loading state. Story 1.1's readiness is factual; urgency and task links arrive in 1.2. These intermediate increments are useful for local verification and review; full V1 rollout requires all four stories and the rollout checklist below.

### Story 1.1: Browse the rental workload and readiness dashboard

As an admin, manager or mechanic,
I want to see departures, returns, bike readiness and delivery destinations for a selected period,
So that I can understand the workload and inspect an order without comparing multiple systems.

**Requirements:** FR-01–09, FR-12, FR-16; CAP-1–5 and CAP-7 (order opening). AD-1–5, AD-7–8, AD-12. NFR-1–4, NFR-6–10. UX-DR1–2, UX-DR4–9, UX-DR11–13, with attention/task-link/ETA extensions owned below.

**Scope:** Staff entry/navigation, URL period resolution, one coherent staff SQL read, typed loader, responsive lists/summary, factual readiness/lifecycle, shared destination precedence and existing order opening. Reuse the established shell and drawer. Add only the workload migration/contracts needed here; no route adapter or new sync-run schema.

**Acceptance Criteria:**

**AC1 — Staff entry and authorization**

**Given** an admin, manager or mechanic with no explicit valid internal login destination,
**When** they enter through root, password login or auth callback,
**Then** Dashboard Today is their default and Dashboard is first in navigation with Workshop retained,
**And** explicit valid next destinations and existing partner/pending handling remain intact; partner, pending and anonymous direct workload requests cannot receive dashboard data, including direct RPC access.

**AC2 — Shared calendar selection**

**Given** a captured server reference instant,
**When** staff select Today, Tomorrow, Next 7 Days, Next Week, Next Month or custom dates,
**Then** both directions and summaries use the approved Madrid calendar definitions, including next week starting on the following Monday even when today is Monday, next complete month and inclusive custom endpoints,
**And** URL state survives reload/history/drawer navigation, missing selection defaults to Today, malformed/reversed dates show a correctable error, and midnight, month/year rollover and both DST transitions use independently resolved local boundaries.

**AC3 — One coherent workload**

**Given** eligible and excluded orders, repeated joins and tasks in the database,
**When** the staff-authorized SECURITY INVOKER read executes under user RLS,
**Then** reserved/started/stopped orders qualify independently by orders.starts_at and orders.stops_at; new/draft/canceled/archived orders are excluded even when tasks remain,
**And** rows, day groups and totals share one snapshot and independently pre-aggregated task/notice inputs without fan-out, external calls, mutations, Node/browser business aggregation or per-row detail fetches. Missing timestamps exclude only that direction; incoming-only and same-period start/return fixtures produce the correct directional totals.

**AC4 — Current-task counts and lifecycle**

**Given** current rental_turnaround tasks on open assignment instances, historical/closed/cancelled tasks, partner units and add-on/checklist records,
**When** workload is summarized,
**Then** every current non-cancelled task counts once, including completed tasks while the assignment remains open; history/add-ons/checklists do not inflate counts,
**And** 7 ready current tasks show 7/7 even with 8 booked units; 6 ready of 8 current tasks show 6/8. Preparation outstanding includes only to_prepare/being_prepared/needs_recheck for outgoing orders in the selected period. Mixed lifecycle displays exact named counts, separately returned and prepare_for_storage, rather than total-minus-ready or a misleading ratio.

**AC5 — Eligible incomplete identity and zero tasks**

**Given** an otherwise eligible order with no current tasks or missing customer/number,
**When** either direction is rendered,
**Then** it remains visible and selectable by local order UUID with explicit missing-name/number text,
**And** zero tasks consistently shows “No Workshop tasks” across dates/directions without all-ready, inferred missing-bike count, invented cause or time escalation.

**AC6 — Destinations and missing information**

**Given** delivery orders with primary, fallback, blank or whitespace-only inputs,
**When** SQL counts and dashboard/shared order display resolve delivery information,
**Then** nonblank delivery_address wins, otherwise maps_link_order, preserving the value/provenance and safe address/link presentation; billing/customer addresses never substitute,
**And** both blank displays “Delivery address missing,” counts in every period, is prominent Tomorrow and high priority Today. A supplied unsupported destination is not missing. Pickup rows have no invented delivery information; unknown fulfillment and incoming collection context remain evidence-based.

**AC7 — Responsive operational view**

**Given** valid workload on tablet/laptop or phone,
**When** staff scan or change the period/direction,
**Then** the approved hierarchy and existing Subframe tokens/components show chronological lists, day groups for multi-day periods and all seven summary measures, with time, identity, fulfillment, readiness/lifecycle, destination and useful today-relative time,
**And** tablet/laptop shows two directions side by side; phone shows one list with an accessible two-label direction tablist. Switching direction preserves dates and starts no sync. Text wraps under zoom/reflow; essential information does not require hover. Commercial/payment fields remain outside the workload payload.

**AC8 — Existing order detail**

**Given** a displayed order,
**When** staff activate its explicit order action,
**Then** OrderDetailsDrawerHost/useOpenOrderDetails opens the existing drawer through ?order=<local UUID> and fetches only that selected order,
**And** close, Escape and Back/Forward preserve other URL parameters and established history/focus behavior. Loading, not-found and detail failure remain distinct; later detail data does not replace workload snapshot counts.

**AC9 — Honest loading and failures**

**Given** cold load, period changes, failed reads or empty directions,
**When** the page renders,
**Then** skeletons do not claim zero workload, new dates never label old rows, and resolved rows/totals/dates/reference update coherently,
**And** failed reads produce explicit Alert errors with safe fallbacks and contextual logs, while successful empty directions have separate empty text. Any sync status uses Workshop-consistent progress/result/error language and makes no claim of selected-period coverage before 1.4.

**Verification owned by this story:** Local SQL fixtures for aggregation, role denial, eligibility/current-task scope, partner/history cases, missing identity, same-day/incoming-only and delivery precedence parity; date tests for all presets/DST; browser checks for role landing, drawer/history, phone tabs, keyboard/focus, loading/error/empty and tablet/phone layout. Verify no silent API row-limit truncation using a sufficiently large fixture, or explicitly deliver partial rows with whole-period totals. Check migration upgrade and replay locally and validate the returned contract. Record initial query plan/time, response and usable-view baseline for representative Today/month/custom datasets; Q14 numerical acceptance remains a pre-rollout decision.

### Story 1.2: Identify preparation priorities and open the relevant Workshop task

As a mechanic or other staff member,
I want today's preparation risks to be clear and the relevant bike tasks reachable from the order,
So that I can move from understanding the workload to doing the required work.

**Dependency:** Story 1.1. **Requirements:** FR-11, FR-13, FR-15; CAP-6 and completion of CAP-7. AD-1, AD-4–7, AD-12. NFR-1–4, NFR-6–10. UX-DR4, UX-DR6–7, UX-DR9–12.

**Scope:** Named urgency thresholds, evidence-based notices/attention summary and staff-only current-task links in the shared drawer. Extend 1.1's common predicates; no new Workshop state machine, historical-task browser, per-row detail loading or standalone warning service.

**Acceptance Criteria:**

**AC1 — Exact today urgency in every range**

**Given** an outgoing order starting today in Madrid with preparation-stage outstanding tasks,
**When** its start is more than 6h, exactly 6h, just above 2h, exactly 2h, or already passed relative to the workload reference instant,
**Then** named thresholds yield low emphasis, warning, warning, critical and critical respectively,
**And** the same rule applies in Today, Next 7 Days and custom/other ranges containing today; other start dates receive no preparation urgency. Revalidation updates labels/reference/urgency together.

**AC2 — Correct affected work**

**Given** 10 ready tasks and 2 outstanding tasks, or mixed preparation/later lifecycle work,
**When** attention is displayed,
**Then** text identifies the actual outstanding count, such as “2 bikes still to prepare,”
**And** in-rental, returned, storage-in-progress and completed tasks never become preparation failures. Tomorrow 0/6 stays informational; zero-task highlights never generate urgency notifications or escalate.

**AC3 — Evidence and deduplication**

**Given** configuration/source notices and preparation or delivery issues affecting an order,
**When** row notices and concise attention are composed,
**Then** identical order/task-and-condition issues appear once, distinct issues remain available, and highest existing severity appears first while timeline order stays chronological,
**And** allocation/add-on-change claims require actual source evidence beyond needs_recheck, affected counts are used when known, and no dashboard read/warning triggers a mutation, sync or cross-order turnaround prediction. Warning resolution uses the shared order/drawer journey.

**AC4 — Current bike-task journey**

**Given** an authorized staff member opens an order in the shared drawer,
**When** current task links load,
**Then** they use the identical current-task predicate as dashboard counts, include current partner units and completed tasks while current, exclude closed/cancelled history, and expose bike identity/status with links to existing /workshop/[taskId] screens,
**And** the links load only for the selected order; failed loading is explicit rather than an empty-task result. Existing task actions and error states remain authoritative.

**AC5 — Shared drawer isolation and accessibility**

**Given** a partner can access an order through the existing shared drawer, or a pending/anonymous caller invokes task loading directly,
**When** staff task data is requested,
**Then** the direct boundary denies it without broadening the existing order permissions,
**And** staff can complete dashboard → drawer → task with keyboard/touch, visible focus and text-based notices, preserving drawer focus/history behavior.

**Verification owned by this story:** Boundary-time and mixed-lifecycle fixtures; database/direct-call task-scope and role checks; actual evidence/deduplication checks; browser journey into an existing Workshop task, including denied role and task-link failure. Confirm source/apply and task state do not mutate on reads. Validate the under-10-second workload scan and under-30-second preparation-priority goals with representative fixtures and record the device context; keep accessibility and Orders/Workshop regression evidence with this story.

### Story 1.3: See approximate driving time for deliveries

As a staff member organizing deliveries,
I want an approximate drive duration from the shop beside the supplied destination,
So that I can judge delivery logistics while keeping the rental workload visible.

**Dependency:** Story 1.1. **Requirements:** FR-10 and the routing-failure portions of FR-08–09; CAP-5. AD-8–9, AD-12. NFR-1, NFR-4–10. UX-DR8, UX-DR11–13.

**Scope:** Separate server-authorized Google Routes v2 adapter, safe tested destination resolution and independent row estimate state. Reuse 1.1's exact destination precedence. No duration cache schema, provider write-back, address editor, live traffic or dispatch workflow.

**Acceptance Criteria:**

**AC1 — Staff-authorized minimal request**

**Given** staff request estimates using local order IDs,
**When** the server authorizes and rereads current order delivery inputs,
**Then** the adapter uses verified shop origin seeded by BUSINESS_ADDRESS and Google Routes v2 DRIVE/TRAFFIC_UNAWARE with only needed fields,
**And** sends only origin/destination/routing parameters, exposes no browser credentials or arbitrary routing proxy, and makes zero provider requests for partner/pending/anonymous callers.

**AC2 — Supported destination resolution**

**Given** a supplied address or Maps value,
**When** the adapter resolves a destination,
**Then** it accepts only tested destination-bearing inputs, prefers explicit place IDs/coordinates where supplied, never treats viewport coordinates as the destination, never scrapes Maps HTML and never silently chooses among ambiguous candidates,
**And** unsupported/ambiguous values retain their original safe display/link with “Drive time unavailable.” If short-link expansion is implemented, every hop enforces an explicit HTTPS Google Maps allowlist, private-network rejection and bounded redirects/response size.

**AC3 — Independent and bounded estimates**

**Given** multiple delivery rows and a slow, failed, quota-limited or timed-out provider,
**When** estimates load separately from workload,
**Then** core counts and lists remain usable, each estimate has its own loading/result/unavailable state, and supplied destinations remain visible without becoming missing,
**And** requests have tested timeouts, concurrency and size limits, within-load deduplication, sanitized contextual failure logs and no retry loop, polling, persistent or cross-request response cache. Drawer-only navigation does not refetch estimates.

**AC4 — Input binding and attribution**

**Given** an estimate was requested for origin/destination/provenance/routing inputs A and the displayed source or selected period changes before it returns,
**When** that response arrives,
**Then** it is discarded unless it still matches the current display context and exact inputs,
**And** a valid result shows “Approx.” duration with required Google Maps attribution and no live-traffic promise. A genuinely missing destination retains the missing-address treatment without a fabricated route request.

**AC5 — Operational readiness**

**Given** the adapter and fixture tests are complete,
**When** estimates are considered for rollout,
**Then** the precise shop origin, supported real URL/address fixtures, ambiguity handling, applicable billing-account terms/privacy notices, restricted server credentials, attribution and explicit quota controls are verified and recorded,
**And** absent provider configuration degrades honestly to unavailable; the free allowance is not described as a spending cap. Any live credential/configuration/provider verification still requires its applicable execution authorization.

**Verification owned by this story:** Mocked provider success/timeout/quota/invalid response, direct role denials with zero requests, input-reread and minimal-payload assertions, URL/redirect safety fixtures if supported, duplicate suppression and late-response A→B tests. Browser checks prove workload availability while routing stalls, destination preservation, attribution, zoom/reflow and no drawer-only refetch. Record actual routing-readiness evidence separately from fixture success; missing rollout evidence remains an explicit gate.

### Story 1.4: Refresh the selected period and recover interrupted syncs

As a staff member relying on the dashboard,
I want to refresh departures and returns for the selected dates and resume interrupted work,
So that I can refresh source data for those dates and recover interrupted work without losing my workload view.

**Dependency:** Story 1.1. **Requirements:** FR-14; CAP-8. AD-4, AD-10–12. NFR-1–4, NFR-6–10. UX-DR3, UX-DR11–12.

**Scope:** Extend existing manual sync discovery/run metadata/checkpoints and dashboard progress/result/error/recovery UI. Reuse the worker, reconciliation, leases and environment gates. Use the same user-facing progress, result and error language as Workshop; saved run scope supports accurate dates, counters and recovery without creating a separate “confidence” status. Add only required run metadata/validation migrations. No replacement engine, scheduler, detached background work or optimization-research redesign.

**Acceptance Criteria:**

**AC1 — Capture and discover the selected interval**

**Given** authorized staff explicitly refresh a valid selected Madrid period,
**When** the run starts,
**Then** it persists a distinct/versioned selected-period scope, exact dates/instant bounds, eligibility-policy version and run ID, discovers reserved/started/stopped source orders starting OR returning within that interval, and captures locally eligible start/return candidates from that same interval at run start,
**And** IDs are deduplicated by Booqable order ID, local out-of-window orders do not enter, and captured candidates still undergo authoritative reconciliation after source cancellation/status/date movement so obsolete dashboard rows can leave.

**AC2 — Durable bounded continuation**

**Given** discovery or reconciliation exceeds one bounded request or navigation interrupts advancement,
**When** staff resume the run after changing the URL or crossing midnight,
**Then** the existing authenticated flow resumes saved server dates, discovery progress, pending/discovered IDs and per-order outcomes rather than recalculating today or trusting wider client scope,
**And** each request awaits bounded work, checkpoints durably, preserves repeated-page protection and existing retries, and requires no detached promise, scheduler or second worker. Local workload remains visible while progress advances or pauses.

**AC3 — Preserve reconciliation semantics**

**Given** a selected candidate with valid, partial, concurrent or mixed fulfillment evidence,
**When** the existing worker fetches and applies its snapshot,
**Then** existing per-order leases/fences, complete-snapshot validation and atomic apply remain authoritative, including task creation and guarded whole-order pickup/return,
**And** there are no partial writes, per-bike fulfillment changes, backward transitions, missed-stage replay or live Booqable write-back. Existing failure/retry recovery remains usable.

**AC4 — Accurate outcomes and counters with familiar sync messages**

**Given** a run with completed or unfinished enumeration and successful, failed, skipped, deleted/unavailable or retried candidates,
**When** sync progress and results are displayed,
**Then** success requires completed enumeration plus every required reconciliation; retries replace each order's outcome rather than inflating counters and skipped/deleted/unavailable candidates cannot be declared successfully refreshed,
**And** in-progress, failed, incomplete, stale and locally empty states remain distinguishable through Workshop-consistent progress/result/error patterns, with actual errors and applicable resume/restart. Unresolved candidates remain explicit failures until existing recovery resolves them.

**AC5 — Run details describe their own scope**

**Given** new selected-period history alongside legacy next_7_days/all_reserved history and an unrelated last_success_at,
**When** the dashboard reports a sync result or staff browse different dates,
**Then** each result's interval, completion, counters and outcome come from the same run; when useful, show the saved range and check time in familiar result/detail text, and keep the recorded dates available when the view changes,
**And** legacy runs retain reserved-only meanings, unrelated timestamps/scopes are never combined, and no label claims global completeness, an atomic source snapshot, future webhook delivery or coverage of a different/wider interval.

**AC6 — Authorization and environment restrictions**

**Given** direct start/resume calls from staff, partner, pending or anonymous users, or an environment where workshopSyncAllowed denies sync,
**When** refresh is attempted,
**Then** staff authorization is enforced at both start and resume before privileged backend reconciliation or provider work, denied users cannot widen scope, and expired sessions follow withAuth login behavior,
**And** the environment gate stays intact with a clear unavailable presentation; dashboard reads remain under user RLS and the narrow backend service-role exception is not extended to other reads.

**AC7 — Upgrade and rollback compatibility**

**Given** existing sync history/cursors and a locally upgraded or replayed schema,
**When** the new entry point is used or the application is rolled back,
**Then** old scopes/cursors remain readable or explicitly restartable without relabeling evidence, and idempotent migrations preserve source/task/history data,
**And** rollback can restore previous staff landing/navigation and disable new routing/selected-period entry points while Orders/Workshop keep working. Hosted migrations remain on the existing branch CI path.

**Verification owned by this story:** Integration/SQL fixtures for incoming-only discovery, outgoing/return deduplication, local stale canceled/moved candidates, exclusion of local out-of-window candidates, pagination/repeated pages, pause/resume across URL/midnight, cursor tampering, leases/partial snapshots, retries/skips/deleted candidates and same-run labels. Direct start/resume role and environment-gate checks; regression tests for existing source-apply whole-order effects. Browser checks for usable lists during sync, scoped progress, failed/stale/unknown/empty distinctions and recovery. Local upgrade/replay and legacy-cursor compatibility checks. Measure representative Today/month/custom sync throughput for Q14 without bypassing environment gates or treating mocks as live throughput evidence.

## Story coverage and completion checks

| Requirement group | Owning story and verification |
|---|---|
| FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-12, FR-16 | 1.1 workload, current tasks, destinations, navigation and direct permissions |
| FR-11, FR-13, FR-15 | 1.2 urgency, evidence-based attention and current-task journey |
| FR-10 | 1.3 independent safe estimates; preserves FR-08–09 semantics |
| FR-14 | 1.4 selected-period refresh and recovery |
| NFR-1, NFR-4, NFR-8, NFR-9; AR-5–8 | All stories at their changed boundaries; direct denial, explicit errors, preserved workflows, local migrations and scope limits |
| NFR-2–3; AR-1 | 1.1 coherent SQL/calendar proof; 1.2 consistent urgency; 1.4 persisted calendar scope |
| NFR-5; AR-3 | 1.1 destination parity; 1.3 provider safety, privacy and bounded execution |
| NFR-6–7 | 1.1 responsive/accessibility baseline; 1.2 scanability and task journey; 1.3–1.4 accessible asynchronous states |
| NFR-10 | Each story owns relevant acceptance evidence; combined release checklist below owns Q14 closure |
| AR-2 | 1.1 shared order opening; 1.2 shared drawer task extension |
| AR-4 | 1.4 existing worker extension and durable recovery |
| UX-DR1, UX-DR2, UX-DR5, UX-DR13 | 1.1 shell, shared dates, phone tabs and device fit; 1.3 verifies estimate wrapping |
| UX-DR3 | 1.4 sync controls/states; 1.1 truthful interim sync messages |
| UX-DR4, UX-DR6, UX-DR7 | 1.1 summary/rows/readiness; 1.2 attention/urgency |
| UX-DR8 | 1.1 supplied/missing destination; 1.3 estimate lifecycle and attribution |
| UX-DR9, UX-DR10 | 1.1 drawer opening/focus; 1.2 current-task navigation |
| UX-DR11, UX-DR12 | All stories' loading/error/empty and accessible interactive states |

The eleven reconciled product scenarios map to 1.1 (1, 3 destination precedence, 4, 6, 7, 8, 9, 11), 1.2 (2, 6 non-escalation, 7 lifecycle/zero-task and task journey), 1.3 (3 estimates, 5) and 1.4 (10). AD-1–5 are covered in 1.1, AD-6 in 1.2, AD-7 in 1.1–1.2, AD-8 in 1.1/1.3, AD-9 in 1.3, AD-10–11 in 1.4 and AD-12 at every applicable boundary. Preserve the full upstream verification matrix when choosing implementation fixtures.

### Epic release checklist — owned within the four stories

- Each story's functional, direct-authorization, failure and relevant migration tests pass; run applicable lint/typecheck/build and existing Orders/Workshop/reconciliation regressions. Record actual commands and evidence at implementation time.
- Verify the complete staff journey on the actual Windows tablet/laptop and a phone, including shared period, both directions, urgency, drawer/task navigation, independent estimates and scoped sync recovery. Confirm keyboard/touch/focus/reflow/contrast rather than inferring accessibility from component names.
- Close Q14 by measuring query plans/time, server response, first usable workload and selected-period throughput with agreed representative volumes/devices. Record agreed numerical acceptance targets and results before rollout; no invented latency guarantee or silent range cap.
- Complete Story 1.3's routing-origin, URL/ambiguity, credential, quota, attribution and applicable terms/privacy checks before enabling estimates. Distinguish live verification from fixture evidence.
- Verify non-destructive rollback and legacy scope/cursor compatibility. Deploy only through the separately authorized existing CI/environment process; this planning artifact is not deployment permission.

### Planning validation

One epic and four stories cover the reconciled functional, architecture and UX requirements. All story dependencies point to earlier work; 1.1 renders useful local workload without future routing/sync/task-link capabilities, and later stories extend that working result. No new infrastructure/starter or unrelated foundations work is required. Tables/functions are introduced only by the story using them. Scope and evidence are attached to each story rather than deferred to an unbounded final testing story.

This is a documentation coverage review, not proof that application behavior, migrations, devices, providers or performance have been tested. Implementation and rollout evidence remain to be produced.
