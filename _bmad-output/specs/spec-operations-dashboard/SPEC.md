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

> **Canonical contract.** Read this kernel and every companion together. Owner-adopted coaching decisions and ARCHITECTURE-SPINE.md override conflicting assumptions in the original product/handoff documents, which remain provenance for unchanged requirements. Repository facts and remaining rollout checks are explicit below. No story breakdown or implementation is authorized by this artifact.

# Echelon Operations Dashboard

## Why

Staff currently need Booqable to understand rental workload and separate Workshop views to understand readiness. Operations gives admin, manager and mechanic a time-based first screen combining outgoing/returning orders, preparation, delivery logistics and honest source confidence, so today’s execution and future planning can happen without manual cross-checking.

## Capabilities

- **CAP-1**
  - **intent:** Staff can start their operational day in Operations while partners retain their own overview.
  - **success:** Admin, manager and mechanic default landings reach Today; partners retain Partner Overview; pending and anonymous users receive no dashboard data.

- **CAP-2**
  - **intent:** Staff can select a Madrid calendar period and retain it while navigating.
  - **success:** Today, Tomorrow, Next 7 Days, Next Week, Next Month and inclusive custom dates are URL-owned; refresh and drawer close preserve the selection; DST does not shift membership.

- **CAP-3**
  - **intent:** Staff can see outgoing and incoming workload, deliveries and preparation scope by order and day.
  - **success:** Totals agree with day groups and rows; starts and stops determine separate sections; same-period start/return appears once in each; accessories never inflate bike totals.

- **CAP-4**
  - **intent:** Staff can understand each outgoing order’s readiness from Echelon-owned Workshop tasks.
  - **success:** Ready tasks are compared with current reconciled bike tasks; Echelon owns task creation and the dashboard trusts that scope. No comparison against booked Booqable quantities is required. Status breakdown, partner units and assignment history remain distinguishable; lifecycle progress is never labeled unprepared.

- **CAP-5**
  - **intent:** Staff can see delivery addresses, missing information and approximate shop-to-destination driving duration.
  - **success:** Every delivery uses delivery_address first and maps_link_order when delivery_address is empty; show “Delivery address missing” when both are empty. Route failure displays “Drive time unavailable” alongside the supplied address/location link and leaves workload usable.

- **CAP-6**
  - **intent:** Staff can identify deterministic operational risks appropriate to the selected timeframe.
  - **success:** Rows starting on today’s Madrid date follow confirmed readiness thresholds in any selected range; future rows do not receive premature readiness urgency; missing addresses and genuine data issues remain visible in every period.

- **CAP-7**
  - **intent:** Staff can inspect an order and reach its bike-level work from the dashboard.
  - **success:** One action opens the existing Order drawer; closing it preserves the timeframe; task navigation reaches existing /workshop/[taskId] screens after the missing drawer-link integration is resolved.

- **CAP-8**
  - **intent:** Staff can judge synchronization confidence and refresh outgoing/incoming orders for the selected Dashboard period through the existing reconciliation flow.
  - **success:** Labels identify the proven sync scope, progress and outcome; failed, incomplete, unknown and empty states differ; start/resume is extended with fixed selected-period coverage; old reserved-only runs never claim the expanded coverage or global completeness.

## Constraints

- Product behavior follows the adopted product document; implementation guardrails follow the adopted handoff. Current user direction overrides their implementation/story instructions: this deliverable is specification only, with no application changes, migrations or stories.
- Read all companions. Repository evidence and contradictions in brownfield.md qualify claims that an implementation already exists; unresolved decisions below are blockers for the affected behavior, not permission to invent defaults.
- Use Europe/Madrid calendar boundaries and URL search parameters. Start membership and return membership are independent; fulfillment does not create a separate lifecycle.
- PostgreSQL must perform cross-table filtering, counting and aggregation under existing role permissions. Do not implement the source document’s optional Node aggregation path, create N+1 order reads, or use service-role reads for the dashboard.
- Reuse the Order drawer, Workshop state machine, assignment history, partner-unit identity, source reconciliation, leases, sync action and error conventions. Do not infer readiness from Booqable state or reproduce detail screens.
- Warnings are deterministic and do not mutate source or Workshop state. Explicit manual sync may retain existing guarded source-apply transitions; do not expand that behavior.
- Delivery routing uses Google Routes API v2 Compute Routes server-side, DRIVE with TRAFFIC_UNAWARE, isolated from workload availability and minimally disclosing. The owner approved Google and delegated remaining routing engineering choices. Do not persist/cache route durations; provider-compatible request deduplication replaces the provisional duration-cache requirement. Preserve supplied delivery data when destination resolution or routing fails.
- Show load failures explicitly with safe data fallbacks; distinguish absence from failure. Keep expected failures in result values, session expiry at the auth boundary, and logs contextual without unnecessary addresses.
- Maintain existing financial/customer/partner permissions, keyboard/focus behavior and text-based status. Measure performance and verify responsive behavior before rollout; no unmeasured timing promise is approved.

## Non-goals

Delivery assignment/dispatch, personal locations/shifts, route optimization or live traffic; new order-detail or Workshop UI; analytics/revenue/forecasting; customer messaging/address requests; Booqable write-back; AI notes interpretation; rider entities or rider-to-bike mapping; automated substitutions; large-group preparation alarms. Future phases in the adopted product document are not V1 commitments.

## Success signal

With representative agreed fixtures, staff can identify today’s outgoing/incoming workload and critical issues in under 10 seconds and a mechanic can identify preparation priorities in under 30 seconds. All adopted acceptance scenarios pass, future missing addresses remain visible, counts agree across surfaces, and order detail is one action away; staff can use Echelon as the first daily planning screen without routine Booqable comparison. Product acceptance of unresolved choices precedes verification of the affected scenarios.

## Assumptions

- A1 resolved by owner: normal login defaults admin/manager/mechanic to Dashboard Today; preserve an explicit next destination after login. Partners retain existing landing behavior.
- A2: Repository inspection describes this checkout at d91f28993907ad90a7bb7614739543dfb932595d on 2026-09-22; it does not prove local or hosted schema/data/provider configuration matches it.
- A3: The configured project-context.md is absent. AGENTS.md and current code supply repository guidance; no missing project context has been fabricated.

## Adopted architecture coaching decisions

- **Naming and navigation:** Use Dashboard as the user-facing name; retain Operations Dashboard as the source feature/package identity. Add Dashboard first in staff navigation for admin/manager/mechanic; retain Workshop and the other existing items. Dashboard does not replace direct Workshop queue access.
- **Q5 resolved — eligibility:** Include only reserved, started and stopped orders, using scheduled start/return dates for independent outgoing/incoming membership. Exclude new, draft, canceled and archived orders from rows and totals, including when they retain Workshop tasks or have dates in range. This read filter does not delete or mutate orders, tasks or history. A missing Booqable order number does not exclude an otherwise eligible order; display “Booqable order number missing” and retain navigation using the local order ID. Distinguish the display number from the Booqable integration ID. Otherwise eligible zero-task orders stay visible and highlighted.

- **Q4 resolved — task ownership (2026-09-22):** Echelon is authoritative for bike tasks; Booqable supplies orders. Dashboard bike totals and readiness use current reconciled bike tasks, without independently classifying order lines or auditing missing tasks against booked quantities. Seven current tasks, all ready, may display 7/7 even when the source booking contains eight units. This explicitly supersedes conflicting expected-unit and task-mismatch requirements in the adopted source documents, including product acceptance scenario 7 and FR-07. An otherwise eligible order with zero current bike tasks must be highlighted as out of the ordinary (owner decision); mixed-lifecycle presentation is resolved below; zero-task orders use one consistent highlight without urgency.

- **Q6 resolved — task presentation (2026-09-22):** Highlight otherwise eligible orders with zero current bike tasks. For mixed lifecycle states, show a status breakdown rather than a bare ready/total ratio; for example, 3 ready, 3 in rental, 2 to prepare. Only preparation-stage tasks contribute to outstanding preparation; handed-over/returned/completed tasks do not. Zero-task orders use one consistent “No Workshop tasks” highlight in every timeframe/direction, without urgency notifications or time-based escalation. Partial returns are operational context only, with no additional feature or workflow requested.

- **Q3 resolved — delivery fallback:** Use delivery_address first; when empty, use maps_link_order as the delivery fallback. Only when both are empty show the missing-address state. Preserve whether the chosen value is an address or a location link. Billing address is not part of this precedence. Routing follows the adopted Q10 boundary; this decision does not add address editing.

- **Q10 provider adopted / engineering delegated:** Google Routes API is approved; the owner considers its 10,000 free monthly requests sufficient and delegates routing details. Use approximate driving without live traffic. Existing BUSINESS_ADDRESS supplies the repository-backed shop origin seed; verify its exact routing destination before rollout. Maps-link support must be based on supported, tested destination extraction; never infer a destination from map viewport coordinates. Unresolvable/ambiguous destinations yield drive time unavailable. Cloud setup and live provider verification are future implementation/rollout work.

- **Q1 resolved — initial readiness urgency:** For Today preparation-outstanding tasks, more than 6 hours before scheduled start is low emphasis; more than 2 hours through exactly 6 hours is warning; exactly 2 hours or less, including overdue, is critical. Keep both thresholds as named configuration values; the owner may revise them later. This does not classify handed-over/later lifecycle tasks as outstanding. The same urgency applies to today’s rows within any selected range (approved Q9); future rows remain planning-only.

- **Q9 resolved — urgency within wider ranges:** Apply readiness urgency to rows whose scheduled start falls on today’s Europe/Madrid date, including Next 7 Days and custom ranges. Future rows remain planning-only. The selected mode does not suppress today’s urgency or extend it to other dates.

- **Q8 resolved — preparation workload:** Count current bike tasks in to_prepare, being_prepared or needs_recheck for eligible outgoing orders whose scheduled start is in the selected period. This is selected-period outstanding work, not a rolling 24-hour window or a direction to prepare future orders immediately. Reuse the same definition for order, day and summary counts; no large-group early-preparation rule.

- **Q2 resolved — calendar presets:** Next Week is the next Monday through Sunday; Next Month is the next complete calendar month, both in Europe/Madrid. Retain Today, Tomorrow, Next 7 Days as today through today+6, and inclusive custom dates. Convert local calendar boundaries to instants rather than adding fixed 24-hour UTC durations.

- **Q7 resolved — defer tight-turnaround detection:** Exclude automated cross-order tight-turnaround warnings from V1. Staff still see the current task-status breakdown for an order, including preparation, in-rental, returned/awaiting storage preparation and storage work in progress. Preserve the distinction between returned and prepare_for_storage. Revisit detection only when a threshold and reliable cross-order physical-bike identity are approved. This does not add a return workflow.

- **Q13 resolved — shared drawer task navigation:** Extend the shared Order drawer with authorized links to current bike tasks and reuse /workshop/[taskId]. Historical tasks stay outside this operational list. Fetch task links on order selection, not separately for every Dashboard row. Preserve existing drawer permissions and timeframe URL behavior; this does not create a second detail screen.

- **Q11 direction adopted — selected-period recovery:** Dashboard refresh follows the selected Madrid date range, including Next Month; cover reserved/started/stopped orders with scheduled starts or returns in range. Reuse existing reconciliation with explicit progress, resumable bounded work and truthful run-specific coverage. Refresh remains separate from rendering local workload. Existing seven-day reserved-only behavior is baseline evidence, not the final Dashboard scope. User reports existing sync is already slow; optimization research is delegated to a separate local worktree/task on feature/optimize-sync-with-booqable, with no implementation authorized. No global freshness claim or unmeasured performance promise. Exact range/run/cursor and stale-local-candidate handling must be fixed in the architecture.

- **Read-model architecture adopted:** Layered read model with one staff-authorized PostgreSQL read function accepting the selected Madrid date range and returning coherent eligible order rows, current-task breakdowns, day groups and totals. Use the authenticated user and RLS; start from orders to preserve zero-task orders, aggregate related records before joining and derive all totals from the same dataset. Keep selected-order detail loading, explicit source synchronization and Google routing outside the read function. SQL object names and internal organization remain implementation details.

- **Q12 resolved — privileged sync exception:** Owner explicitly permits service-role use inside the existing server-side Booqable reconciliation worker for staff-triggered sync, after admin/manager/mechanic authorization. This narrow exception covers synchronization locks and transactional source reconciliation; it does not grant privileged Dashboard, drawer or general user-facing data reads. Keep the key server-only and reuse the worker. This decision explicitly overrides the webhook/seeder-only wording of AGENTS.md for this worker alone.

## Open Questions

Product choices required for the architecture are resolved. The remaining item is a pre-rollout acceptance check, not permission to invent a performance promise. Repository facts and exact evidence are in brownfield.md.

- **Q14:** Set a measurable query/render latency target and realistic order-volume/device test envelope after baseline measurement; hosting telemetry and staff devices were not accessed.
