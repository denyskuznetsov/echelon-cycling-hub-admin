---
name: Echelon Operations Dashboard
status: final
created: 2026-09-22
updated: 2026-09-22
sources:
  - .memlog.md
  - ../../../specs/spec-operations-dashboard/SPEC.md
  - ../../../specs/spec-operations-dashboard/ARCHITECTURE-SPINE.md
  - ../../../specs/spec-operations-dashboard/data-contract.md
  - ../../../specs/spec-operations-dashboard/verification.md
visual_identity: DESIGN.md
---

# Operations Dashboard — Experience

## Foundation

Internal responsive web dashboard for admin, manager and mechanic. Primary device: Windows tablet/laptop, regularly using both touch and keyboard/mouse. Smartphone is second; other laptops including MacBook are third. Inherit the existing Echelon Subframe system; [DESIGN.md](DESIGN.md) owns visual identity. This contract specifies the high-level experience, not application implementation.

The confirmed sources own eligibility, task counts, calendar rules, warning thresholds, delivery precedence and sync evidence. This document expresses their UX consequences without replacing those rules. No new brand, task workflow or dashboard editing flow is introduced.

## Information Architecture

| Surface | Entry and purpose | Journey |
|---|---|---|
| Dashboard — Today | Default staff landing and first navigation item; identify outgoing/incoming work and immediate preparation needs. Explicit valid login destinations still win. | Den's working day |
| Dashboard — selected period | Same page with a shared date filter; inspect upcoming workload and task status, grouped by day. | Den plans ahead |
| Shared Order drawer | One action on an order; inspect existing details and select a current bike task. Preserves selected period. | Den's working day; Den checks delivery |
| Existing Workshop task screen | Current task link inside the drawer; perform the work using the existing workflow. | Den's working day |

Page order is header/shared period/sync → workload summary → concise attention → Going out / Coming back. Summary and day counts retain the source contract: outgoing and incoming orders/bikes, outgoing delivery orders, outstanding preparation, and missing-address deliveries. Directional totals are not a unique combined order count; an order can occur in both lists.

Visual coverage: [tablet/laptop Today and Next 7 Days](mockups/key-dashboard-tablet.html), and [phone Going out / Coming back](mockups/key-dashboard-phone.html). The user confirmed these are sufficient; the existing Order drawer and Workshop task screen are spine-only and inherit the app. The mock order affordance leads to the established drawer flow; it does not add a task shortcut.

The outgoing row exposes scheduled time, customer/order reference, fulfillment, bikes/readiness, relevant lifecycle breakdown, actual delivery destination and approximate duration where applicable, and concise warnings. Today's outgoing rows also show useful relative start time. Incoming rows expose return time, customer/reference, bikes, relevant lifecycle breakdown and reliable collection context. Commercial details stay in the existing drawer.

## Voice and Tone

Use short factual labels that state the condition and scope. Keep the established names “Dashboard,” “Going out,” “Coming back,” “Today,” “Tomorrow,” “Next 7 Days,” “Next Week,” and “Next Month.” Custom dates are inclusive and all calendar labels use Europe/Madrid.

| Condition | Copy rule |
|---|---|
| Preparation incomplete | Give actual affected count and time context, e.g. “2 bikes still to prepare.” Do not describe handed-over bikes as unprepared. |
| Zero current tasks | Use “No Workshop tasks”; never “All ready,” inferred missing bikes or an invented cause. |
| Missing source identity | Explicit missing-name text; use “Booqable order number missing” when applicable. Keep the order selectable. |
| Delivery input absent | “Delivery address missing.” |
| Supplied destination cannot be routed | Preserve it and show “Drive time unavailable.” |
| Estimate available | “Approx.” duration with required Google Maps attribution; no live-traffic promise. |
| Empty direction | State no outgoing/incoming orders in the selected period; do not imply verified source completeness. |
| Unknown sync evidence | “Sync confidence unavailable”; no generic “Everything is up to date.” |

## Component Patterns

Visual specs and Subframe inheritance live in DESIGN.md.Components. Names match that table.

| Component | Behavioral contract |
|---|---|
| App shell | Staff see Dashboard first and retain Workshop. Preserve existing partner/pending destinations and authorization boundaries. |
| Shared period control | One selection updates both directions and summaries. Default Today; support the approved presets and inclusive custom range. URL owns dates; refresh, drawer navigation and browser history preserve them. Reject malformed/reversed dates explicitly. |
| Sync control and confidence | Explicit selected-period refresh, progress and recovery. Keep local workload visible. Display the saved run's dates if different from the current view; resume that saved interval. Preserve environment gates. |
| Workload summary | Report the selected period's coherent source totals. Preparation workload means outstanding preparation tasks for outgoing orders in that period. No independent math or alternative denominator. |
| Attention summary | Concise summary of actual row conditions. Deduplicate the same issue, retain distinct issues, and present highest severity first without reordering the chronological lists. |
| Direction switch | Phone users switch Going out / Coming back without changing period. Only the active list is shown. Support an accessible tablist with selected state, keyboard movement and labeled panel; Subframe appearance alone does not provide those behaviors. |
| Day heading | Group multi-day results by Madrid calendar date. Today/Tomorrow remain chronological. Keep each direction's date context independently clear. |
| Order row | One action opens the existing Order drawer, retaining URL range and history. Explicit focusable order action supports keyboard and touch. Readiness is summary information, not a direct task-edit control. |
| Readiness and warning labels | Ready/total only while tasks are preparation/ready stages. Mixed lifecycle uses exact counts, including in rental, returned/awaiting storage preparation, storage work in progress and completed. Zero tasks has a consistent non-escalating highlight in both directions. |
| Delivery details | Show nonblank delivery_address, otherwise maps_link_order; never infer from billing/customer address. Load the approximate drive duration independently; preserve supplied input on failure and never display a stale estimate beside changed input. |
| Order drawer | Reuse shared open/close, history and focus behavior. Load current authorized bike-task links only for the selected order; each carries bike identity and status. Historical tasks remain outside this list. |
| Workshop task screen | Current task link opens the existing task route; existing task states, errors and actions remain authoritative. |
| Feedback state | Differentiate loading, empty, validation failure, workload failure, detail failure and optional estimate failure. Use the existing Alert error presentation for failed reads. |

## State Patterns

| Surface/state | Required behavior |
|---|---|
| Dashboard cold load | Loading structure, never placeholder zero counts implying no work. Core workload resolves independently of estimates. |
| Dashboard period change | Indicate loading and keep control context; never label old rows as belonging to new dates. Replace totals, rows, date labels and urgency coherently. |
| Invalid period | Show a date validation error at the period control; allow correction, never silently broaden the range. |
| One/both directions empty | Explicit per-direction empty text; show sync confidence separately. A locally empty result is not a load failure or proof of complete source coverage. |
| Workload error / network unavailable | Visible error and safe fallback, never “No orders” as the failure response. Preserve navigation and controls; no offline-work or queued-write promise. |
| Sync active | Scoped progress while local lists remain usable; incomplete discovery is not success. Navigation may pause advancement; saved work remains explicitly resumable. |
| Sync failed / incomplete / stale / unknown | Distinct factual state plus applicable resume/restart recovery. Show failure information and recorded dates; avoid a fresh-success treatment. |
| Sync complete | Only proven enumeration and successful required reconciliations permit a scoped “Orders starting or returning [dates] checked at [time]” label. Legacy reserved-only evidence keeps its narrower meaning. |
| Sync unavailable in environment | Preserve existing environment restriction and explain unavailability; do not offer an apparently working action. |
| Delivery estimate loading / failed | Local inline estimate state; destination and workload stay visible. Missing address is separate from a supplied but unroutable destination. |
| Drawer loading / failed / absent | Inherit skeleton, explicit load error and not-found distinction; a failed task-link load must not appear as an empty task list. |
| Workshop task loading / failed / unavailable | Existing task-screen behavior; do not substitute a dashboard workflow. |
| Session expired / access denied | Existing login/session handling; denied roles receive no staff dashboard or task data. Hide navigation as appropriate but retain direct-access enforcement. |
| Focus / selected / disabled | Every control exposes its state and visible focus. Closing the drawer restores focus to its opener or a sensible surviving location. |

## Interaction Primitives

Tap/click and keyboard activation are equally supported. No essential information or action relies on hover, swipe or long-press. Order activation opens the drawer; the current bike-task link then opens Workshop. Closing the drawer and browser Back/Forward preserve selected dates and established history behavior.

Changing the phone direction does not initiate sync or change the shared period. Dashboard reads and warning displays never advance tasks. Refresh is explicit and its selected dates are captured when the run starts, even if Den later browses another range.

## Accessibility Floor

Use semantic headings, labeled controls, lists and date groups; expose order identity, schedule and readiness as text. Reading/focus order follows the page hierarchy and active directional list. Preserve visible focus and drawer focus containment/return, with Escape close behavior inherited from the shared drawer.

Use {typography.body} and {typography.emphasis} from DESIGN.md for operational content; do not shrink essential content into metadata to force two columns. Support text zoom and reflow. Provide adequately spaced touch targets, targeting at least 44 CSS pixels for primary controls as an implementation accessibility criterion. Status is never color-only; announce loading/result/error changes without repeatedly interrupting reading. Reduced motion must not remove feedback. Contrast targets are defined in DESIGN.md and still require rendered verification.

## Responsive & Platform

| Context | Composition |
|---|---|
| Windows tablet/laptop and other laptops | Side-by-side Going out and Coming back; shared range and sync above. Both touch and keyboard/mouse remain supported regardless of viewport. |
| Smartphone | Visible two-option Going out / Coming back switch above one list; same shared period and information semantics. Wrap delivery and state details; no horizontally clipped miniature desktop table. |

The existing theme defines `mobile` up to 767px. Treat that as the inherited starting point; exact fit, portrait tablet behavior and density need visual verification on the actual Windows viewport. That breakpoint has not been device-tested in this UX run. Do not lose either direction or essential row information under zoom/reflow.

## Inspiration & Anti-patterns

The [Booqable screenshot](imports/booqable-dashboard-reference.png) establishes the approved side-by-side direction lists, visible date controls and clear day grouping. The deliberate difference is one shared period control. See [reference reconciliation](reconcile-booqable-reference.md).

Do not inherit unapproved “All / Pickups / Deliveries” tabs, reports, late-only views, Booqable navigation or row contact/avatar treatments. Do not add direct task shortcuts, task editing, return workflows or routing/dispatch tools to this dashboard.

## Key Flows

### Den's working day — CAP-1, CAP-3, CAP-4, CAP-6, CAP-7

1. Den is on mechanics duty and opens the app on the Windows tablet. With no explicit alternate destination, Dashboard Today opens.
2. He scans outgoing times and preparation counts alongside incoming workload.
3. An order leaves at 11:00; at the captured 09:00 reference two current tasks still need preparation. It carries critical urgency because exactly two hours qualifies.
4. Den selects the order, then its relevant current bike task in the existing drawer.
5. **Climax:** the existing Workshop task screen gives Den the work he came to do; he proceeds using the established workflow.

Failure path: workload or selected-order failure is visible rather than empty. No current tasks shows “No Workshop tasks” without inventing missing work or a preparation alarm. Task-screen errors retain existing handling.

### Den plans ahead — CAP-2, CAP-3, CAP-4, CAP-6

1. Den changes the single shared period to Next 7 Days.
2. Both directions show date-grouped orders and day context for the same period; preparation and lifecycle status remain visible.
3. Today's departures retain qualifying urgency. Future departures show readiness without premature urgency; missing delivery information remains visible.
4. On his phone Den switches between Going out and Coming back while keeping the selected period.
5. **Climax:** Den can understand upcoming outgoing and returning work without losing today's operational risks or changing date filters twice.

Failure path: an invalid custom range produces an explicit correction opportunity; a failed load never pretends the planned period is empty.

### Den checks delivery — CAP-5, CAP-6, CAP-7

1. Den scans a delivery order in the outgoing list.
2. The supplied destination and any approximate duration appear with the order; a missing destination is explicitly highlighted.
3. Den opens the shared Order drawer when he needs the existing details.
4. **Climax:** Den knows whether the delivery has a destination and an available approximate drive duration, without leaving the workload context.

Failure path: a supplied but unroutable destination stays visible with “Drive time unavailable”; the dashboard neither substitutes another address nor offers a new editor.

### Den checks synchronization — CAP-8, CAP-2

1. Den inspects the scope and result of the recorded sync evidence for his selected period.
2. He explicitly refreshes that period; local outgoing/incoming workload remains visible alongside bounded progress.
3. If he changes the view or returns after a pause, the run keeps its original dates and offers the existing resume/restart recovery as applicable.
4. **Climax:** a successful result identifies exactly which period was checked; otherwise Den sees why coverage is incomplete and the available recovery action.

Failure path: failed, incomplete, stale and unknown confidence remain distinct. A legacy reserved-only run is not presented as coverage of incoming orders or a broader period.

## Handoff and verification boundary

High-level navigation and composition are finalized. The user skipped additional validation and confirmed mock coverage; no optional reviewers ran. The HTML references use fictional sample orders and static controls, and were checked against these contracts at source level. Browser opening was blocked by the browser URL security policy, so no rendered browser/device validation is claimed.

Exact row density, narrow tablet fit, control semantics and accessibility require verification during implementation. Q14 performance acceptance and routing rollout prerequisites remain owned by the upstream specification. No application, provider or device test ran in this UX work.
