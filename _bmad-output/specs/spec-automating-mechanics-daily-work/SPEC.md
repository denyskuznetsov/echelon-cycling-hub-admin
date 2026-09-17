---
id: SPEC-automating-mechanics-daily-work
companions:
  - workflow-state-machine.md
  - checklist-contract.md
  - launch-checklists.md
  - booqable-reconciliation.md
  - ../../planning-artifacts/architecture/architecture-echelon-cycling-hub-admin-2026-08-20/ARCHITECTURE-SPINE.md
sources:
  - ../../brainstorming/brainstorm-automating-mechanics-daily-work-2026-08-20/brainstorm-intent.md
  - ../../research/technical-booqable-physical-bike-id-assignment-det-2026-08-20/research.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Automating Mechanics' Daily Bike Work

## Why

Mechanics currently rely on one paper checklist per physical bike, leaving stage completeness, responsibility, and handoffs difficult to enforce or audit. Replace that paper flow with one touch-first task per identified rental bike, covering preparation, re-check, pickup, return, and storage while preserving the team's transferable, unassigned way of working.

## Capabilities

- **CAP-1**
  - **intent:** The system reconciles authoritative Booqable order state into one independent task per specifically identified physical bike.
  - **success:** Every identified bike produces one task even when another bike remains unidentified or the identified bike lacks a recognized workshop tag; repeated unchanged snapshots produce no duplicates.
- **CAP-2**
  - **intent:** Mechanics can find and open due bike tasks in Today, Tomorrow, and Next 7 days work queues.
  - **success:** Changes to the Booqable order start date move tasks to the correct queue using the `Europe/Madrid` timezone, and a mechanic can operate the workflow on a stand-mounted tablet using large touch targets and minimal actions.
- **CAP-3**
  - **intent:** The system selects the preparation checklist associated with the bike product's workshop-type tag.
  - **success:** Each mapped tag opens the correct ordered local checklist; an identified bike with no recognized tag still gets a visible task, but shows a configuration warning and cannot start preparation.
- **CAP-4**
  - **intent:** Any mechanic can perform M1 preparation and attest final responsibility for the completed stage.
  - **success:** Every required action and PSI item is completed or explicitly marked N/A where allowed before one atomic, authenticated transition records signer identity and time.
- **CAP-5**
  - **intent:** Any mechanic can verify designated M2 items and attest that the bike is ready.
  - **success:** Readiness is gated on every designated verification, M2 confirms M1's recorded PSI or N/A outcome rather than replacing it, and a same-person M1/M2 signer must explicitly confirm that fact before the signed transition.
- **CAP-6**
  - **intent:** Mechanics can view current order add-ons and confirm that preparation matches them before readiness.
  - **success:** Current add-ons remain visible throughout the task, and `Ready for Pickup` cannot be reached without the confirmation.
- **CAP-7**
  - **intent:** Eligible authenticated staff can manually record bike pickup and return, while authoritative whole-order Booqable refreshes can apply those same two forward edges.
  - **success:** Any non-partner staff member can manually move `Ready for Pickup` to `In Rental` and `In Rental` to `Returned`; a complete whole-order pickup or final returned order applies only the matching guarded edge to eligible tasks, while mixed operations remain manual and partner-role users cannot invoke staff commands.
- **CAP-8**
  - **intent:** A mechanic can perform and attest one shared post-rental storage checklist.
  - **success:** `Returned` moves through `Prepare for Storage` to terminal `Completed` only after all six required storage items have a valid completion or allowed N/A outcome, with one authenticated signer and no M2 stage.
- **CAP-9**
  - **intent:** The system invalidates tasks whose physical-bike assignment disappears or changes.
  - **success:** Removal or order cancellation terminally cancels affected work; replacement creates a fresh `To Prepare` task with no transferred history; an open invalidated task becomes non-actionable and clearly directs the mechanic to abandon it.
- **CAP-10**
  - **intent:** Staff can recover assignment drift through manual synchronization and understand synchronization health.
  - **success:** Webhook and manual sync converge through the same reconciler, overlapping sync runs are prevented, the last successful sync time is visible, and an incomplete Booqable response leaves existing tasks unchanged while surfacing the failure.

## Constraints

- Work history belongs to one physical-bike task and never transfers to a different bike.
- Work remains unassigned, transferable, and unlocked; checkbox-level authorship is not recorded.
- Stage attestations derive only from the authenticated user, immutably retain user identity and timestamp, display first and last name, and mean final responsibility for the stage.
- Stage completion validates required work and records signer, time, and status transition atomically.
- Preparation checklists are local and preconfigured; MVP interactions are action completion, configured N/A selection, and numeric PSI entry only.
- Launch workshop tags are `workshop-road-bike`, `workshop-e-city-bike`, `workshop-e-mtb-bike`, `workshop-gravel-bike`, and `workshop-e-road-bike`.
- A recognized workshop tag is not required to create a task for an identified bike; its absence is a Booqable product-configuration error that blocks preparation until corrected and synchronized.
- Dashboard date groups use the Booqable order start date in `Europe/Madrid`.
- Booqable supplies bike identity, rental timing, add-ons, invalidation, and authoritative whole-order pickup/return evidence; staff explicitly confirm physical preparation and storage completion, and retain guarded manual pickup/return for mixed or mismatched cases.
- `order.updated` is a signal to fetch authoritative state, not a payload to interpret; webhook and manual sync use the same idempotent reconciler, with no periodic polling.
- Reconciliation is serialized per order and enforces uniqueness equivalent to Booqable order ID, stock item ID, and task kind.
- Reconciliation changes no existing task or assignment state unless the complete Booqable order snapshot loads successfully.
- Manual sync checks every reserved Booqable order starting within the next seven days, including orders with no task yet; dashboard pagination does not limit its source scope.
- Booqable `stock_items.id` is the physical identity key; the editable human identifier is display metadata, without asserting contractual UUID permanence.
- Invalidated tasks remain as terminal `Cancelled` history and are hidden from normal work queues.
- Add-on changes after `Ready for Pickup` update the display but do not reopen or change task status.
- Every bike type uses the same six-item Prepare for Storage checklist in MVP.
- Architecture spine AD-1 through AD-13 bind implementation HOW; diagrams stay in that companion.
- Detailed workflow, checklist, integration, recovery, and validation constraints in the companion files are binding.

## Non-goals

- Task assignment, reassignment, locking, or per-checkbox authorship.
- Staff-profile dropdown signatures or manager approval for same-mechanic M1/M2 completion.
- Checklist-template administration, runtime checklist inheritance, generalized form building, arbitrary value types, or free-text values.
- QR codes, scanning, or another physical/digital handoff mechanism.
- Individual partial-operation automation, automatic backward transitions, or pickup/return inferred from dates, webhook names, or simplified `started` status alone.
- Periodic assignment polling or automatic reopening after late add-on changes.
- Hard deletion of invalidated task history.
- Bike-type-specific post-rental storage checklists.

## Success signal

- For a reserved order containing identified, unidentified, removed, and replaced bikes, the system converges to exactly one valid task per current physical bike and preserves cancelled history without transferring work. Staff can then demonstrate the complete guarded lifecycle from `To Prepare` through signed M1, signed M2, pickup, return, signed storage, and `Completed` on a tablet.

## Open Questions

- What are the ordered launch items for the four remaining preparation tags?

## Tenant spike 2026-08-21

Resolved against live order 344. Evidence: `_bmad-output/implementation-artifacts/booqable-spike-evidence.md`. AD-2/AD-10 amended the same day.

- Include: `customer,coupon,lines,lines.planning,lines.planning.stock_item_plannings,lines.planning.stock_item_plannings.stock_item,lines.item` (HTTP 200).
- Workshop tag: `products.attributes.tag_list` (ignore `*-bundle` on the bundle line).
- Statuses: `reserved` / `started` (picked up) / `stopped` (returned) / `canceled`. Cancel from `stopped` was not possible in the UI.
- Read-after-write: first GET after each human report already matched; no debounce ms claimed.
- Still **not observed** (do not invent): webhook copies, debounce window, `429`/`Retry-After`, same-product A→B→C, cross-page drift check.
