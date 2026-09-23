---
id: SPEC-operations-dashboard
companions:
  - ARCHITECTURE-SPINE.md
  - brownfield.md
  - data-contract.md
  - verification.md
  - ../../../docs/features/operations-dashboard-spec.md
  - ../../../docs/features/operations-dashboard-codex-handoff.md
  - ../../../AGENTS.md
sources: []
---

> **Canonical contract.** Read this kernel and every companion together. The adopted rules in ARCHITECTURE-SPINE.md and the explicit overrides in verification.md supersede conflicting original product/handoff requirements and the narrow worker restriction in AGENTS.md. Unchanged requirements remain binding. This reconciliation authorizes documentation only.

# Echelon Operations Dashboard

## Why

Staff need Booqable for rental workload and separate Workshop views for readiness. Dashboard gives admin, manager and mechanic one time-based first screen for outgoing/returning orders, preparation, delivery logistics and honest sync confidence, so daily execution and future planning do not require routine manual comparison across systems.

## Capabilities

- **CAP-1**
  - **intent:** Staff can start their operational day in Dashboard while partners retain their own overview.
  - **success:** Admin, manager and mechanic default to Dashboard Today and see Dashboard first in navigation with Workshop retained. Explicit valid internal login destinations survive; existing partner/pending handling remains. Partner, pending and anonymous users receive no Dashboard data.

- **CAP-2**
  - **intent:** Staff can select a Madrid calendar period and retain it while navigating.
  - **success:** Today, Tomorrow, Next 7 Days, Next Week, Next Month and inclusive custom dates survive refresh and drawer navigation. Missing selection defaults to Today; invalid/reversed dates fail explicitly. Calendar membership, labels and urgency agree across midnight and DST under AD-4.

- **CAP-3**
  - **intent:** Staff can see outgoing and incoming workload, deliveries and preparation scope by order and day.
  - **success:** Reserved/started/stopped orders enter each direction independently by scheduled start/return; row, day and period totals agree. Missing customer/number and zero-task orders remain visible when eligible. Bike counts use current Workshop task scope; accessories, booked-line quantities and checklist/add-on rows do not add units. Preparation workload covers outstanding tasks for selected-period outgoing orders.

- **CAP-4**
  - **intent:** Staff can understand order readiness and lifecycle progress from Echelon-owned Workshop tasks.
  - **success:** Ready/total uses current tasks; seven ready tasks may show 7/7 even if eight units were booked. Later lifecycle stages display distinct status counts, including returned versus storage preparation, without becoming preparation failures. Zero tasks displays one consistent “No Workshop tasks” highlight across dates/directions, without escalation, inferred missing units or an all-ready claim. AD-1/5 define the shared task scope and status meanings.

- **CAP-5**
  - **intent:** Staff can see delivery destinations, missing information and approximate shop-to-destination driving duration.
  - **success:** Nonblank delivery_address wins, then maps_link_order; both blank yields “Delivery address missing.” Supplied but unresolved/unroutable values remain visible with “Drive time unavailable.” Approximate estimates appear only beside their matching current inputs and never delay core workload. AD-8/9 govern shared precedence and routing.

- **CAP-6**
  - **intent:** Staff can identify deterministic operational risks appropriate to the selected dates.
  - **success:** In every selected range, outgoing rows starting today in Madrid apply named preparation thresholds: >6h low emphasis; >2h and <=6h warning; <=2h including overdue critical. Other dates, later lifecycle tasks and zero-task highlights do not receive preparation urgency. Missing delivery data stays visible in every period, prominent Tomorrow and high priority Today. Existing configuration/source notices remain evidence-based and deduplicated under AD-6.

- **CAP-7**
  - **intent:** Staff can inspect an order and reach its current bike-level work from Dashboard.
  - **success:** One action opens the shared Order drawer without losing the selected period or history/focus behavior. On selection, authorized current-task links reach existing /workshop/[taskId] screens. Historical tasks stay outside this list; partners do not receive staff task data.

- **CAP-8**
  - **intent:** Staff can judge synchronization confidence and refresh outgoing/incoming orders for the selected Dashboard period.
  - **success:** Start/resume uses a fixed recorded period, includes in-window local candidates whose source status/dates later moved, and shows bounded progress while local workload stays visible. Success proves completed enumeration and every required reconciliation for that run. Failed, incomplete, stale, unknown and locally empty states differ; legacy reserved-only evidence never claims expanded or global coverage. AD-10/11 govern recovery and truthful labels.

## Constraints

- Use the final architecture spine's twelve adopted rules. data-contract.md owns field/status/presentation detail; verification.md owns source overrides and acceptance mapping; brownfield.md records dated repository evidence and missing integration work.
- Use Europe/Madrid dates and URL-owned period state. One captured reference instant governs each workload result; selected sync dates remain fixed across resume and later navigation.
- Use one staff-authorized PostgreSQL SECURITY INVOKER read function under user RLS for coherent order/day/period counts. Aggregate before joining; no Node/browser aggregation, per-row detail fetches, silent truncation, external calls or mutations inside the workload read.
- Enforce admin/manager/mechanic authorization at direct workload, task-link, routing and sync boundaries. Reuse trusted profile roles and existing session/error conventions. The recorded AD-12 service-role exception applies only inside existing backend reconciliation after staff authorization, including resume; Dashboard/drawer reads remain user/RLS-bound.
- Reuse the shared drawer, Workshop state machine, current assignment/partner-unit identity, history, leases and transactional reconciliation. Reads/warnings never change state; explicit sync retains existing task creation and guarded whole-order pickup/return behavior without per-bike fulfillment, backward transitions or missed-stage replay.
- Use the approved server-side Google Routes v2 DRIVE/TRAFFIC_UNAWARE adapter independently of workload. Minimize disclosed data; authorize and reread inputs server-side; preserve supplied destinations on failure. No persistent or cross-request route-result cache; deduplicate within a load and avoid polling/drawer-only refetches. AD-9 defines destination safety, attribution, input binding and bounded execution.
- Show load failures explicitly with safe fallbacks; distinguish absence from failure and session expiry from recoverable results. Preserve financial/customer/partner permissions, contextual sanitized logs, keyboard/focus behavior and text-based status.
- Preserve environment sync gates and existing runtime. Future schema changes must be idempotent, verified locally and delivered remotely through branch CI. Keep old sync evidence compatible and rollback non-destructive. Q14 and routing/configuration checks in verification.md must be satisfied before rollout; no unmeasured latency promise or new user-visible range cap is approved.

## Non-goals

- Independent booked-bike classification or task-completeness auditing; cross-order tight-turnaround prediction; historical task browsing in the drawer; new return workflow; automated large-group preparation alarms.
- Delivery assignment/dispatch, van planning, staff locations/shifts, route optimization or live traffic; customer messaging/address requests or a new address editor; Booqable write-back; automatic substitutions.
- Duplicate order-detail or Workshop UI; analytics/revenue/forecasting; AI interpretation of notes; rider entities or rider-to-bike mapping. Later product phases are not V1 commitments.
- A new sync engine, scheduler, worker system, feature-flag platform or dependency upgrade. Separate sync-optimization research does not authorize a batch/concurrency redesign here.

## Success signal

With representative agreed fixtures, staff identify today's outgoing/incoming workload and critical issues in under 10 seconds; a mechanic identifies preparation priorities in under 30 seconds. All reconciled acceptance scenarios in verification.md pass: counts agree, future missing destinations remain visible, recovery labels prove their scope, and shared order detail is one action away. These are scanability goals, not network-latency targets.

## Open Questions

- **Q14 — pre-rollout performance acceptance:** After baseline measurement, agree numerical query/render targets and a realistic order-volume/device envelope, including selected-period sync throughput. Product choices for the architecture are resolved; provider readiness and bounded execution settings remain implementation/rollout verification, not unanswered product choices.
