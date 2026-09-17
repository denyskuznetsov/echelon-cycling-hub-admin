---
title: 'Booqable pickup and return synchronization for Workshop'
type: requirements-draft
created: '2026-09-17'
updated: '2026-09-17'
status: complete
epic: null
workflow: bmad-create-epics-and-stories
currentStep: complete
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
validationOutcome: passed
workflowComplete: true
inputDocuments:
  - 'User feature outline, screenshot, and clarification replies in the 2026-09-17 conversation'
  - '../../specs/spec-automating-mechanics-daily-work/SPEC.md'
  - '../../specs/spec-automating-mechanics-daily-work/workflow-state-machine.md'
  - '../../specs/spec-automating-mechanics-daily-work/booqable-reconciliation.md'
  - '../architecture/architecture-echelon-cycling-hub-admin-2026-08-20/ARCHITECTURE-SPINE.md'
  - '../../specs/spec-booqable-customer-created-sync/webhook-cutover.md'
  - 'Current repository implementation; evidence paths below'
  - 'https://developers.booqable.com/'
  - 'https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow'
---

# Booqable pickup and return synchronization for Workshop

## Purpose and planning boundary

Prepare one self-contained implementation story, without an epic, for automatic Workshop pickup and return transitions following an authoritative Booqable refresh. Requirements are confirmed; story drafting is authorized. This planning work does not authorize feature implementation or tenant changes.

The user explicitly requests a small feature and collaborative pressure testing. The existing project-wide `epics.md` is not the output for this standalone request. The selected inputs were confirmed by the user; historical documents supply context, and the current request supersedes their exclusion of automatic pickup and return.

## Confirmed product decisions

1. Automate only `ready_for_pickup → in_rental` and `in_rental → returned`.
2. A pickup must not advance a task that is not already Ready for Pickup. A return must not advance a task that is not already In Rental.
3. Preserve checklist completion and sign-off requirements. Booqable synchronization must never complete checklists or manufacture signatures.
4. **P0 scope selected:** Automate only unambiguous whole-order pickup and return. Mixed orders remain manual. This supersedes the original request to automate individual partial pickups/returns.
5. Apply the same rules when the task's **Sync order details from Booqable** action refreshes the order.
6. Completing Workshop checks alone must not trigger automatic pickup. After a blocked pickup, automation can reconsider the task only when order details are subsequently refreshed from Booqable. The refreshed state must still justify the transition.
7. Mechanics retain the existing manual pickup and return flow, including its existing guards. A task can therefore progress manually without waiting for another refresh.
8. Use the feature outline and screenshot, existing Workshop specification/architecture, current implementation, and official Booqable documentation as inputs. The user will supply additional historical decisions as discussion continues.
9. If a refresh first observes Returned while Workshop is still Ready for Pickup, preserve the Workshop stage, explain the mismatch, and let staff correct it through the manual flow. Do not automatically apply two transitions to catch up.
10. Booqable reversals do not automatically move Workshop backward. Keep its current stage and show a mismatch.
11. Partner Bike tasks participate in whole-order automation under the same local guards. The P0 does not need to identify which synthetic partner unit participated in a partial operation, because mixed orders remain manual.
12. Each task is evaluated independently against its required local predecessor. One blocked task does not prevent eligible sibling tasks from advancing.
13. **Return signal clarified:** Trust Booqable's final whole-order Returned state (`order.status = stopped` in the fetched API snapshot). Booqable owns deciding which products must be returned. Do not add an item-by-item return check, require non-returnable sales items to become stopped, or reject that final order state solely because product-level states differ. Pressing the Returned button without reaching the final Returned order state is not sufficient.

## Selected P0 transition matrix

| Authoritative order fulfillment | Current task stage | Automatic outcome |
|---|---|---|
| Unambiguously fully picked up | Ready for Pickup | In Rental |
| Final Returned order state (`order.status = stopped`) | In Rental | Returned |
| Mixed | Any | No pickup/return automation; normal manual actions remain available |
| Fully picked up | Earlier preparation stage | No transition; explain incomplete local readiness |
| Fully returned | Ready for Pickup or earlier preparation stage | No transition; explain mismatch and manual recovery |
| Unchanged fully picked-up state on a later refresh | Task has since reached Ready for Pickup | In Rental |
| Reversed upstream state | Locally later stage | No backward transition; explain mismatch when detectable |
| Any | Completed or Cancelled | No pickup/return transition or reopening |
| Unknown or ambiguous fulfillment | Any | No pickup/return automation; do not infer a uniform state |

The matrix applies to all current tasks belonging to the refreshed order, including partner bikes. Cancellation/removal processing retains precedence under the existing invalidation rules. Tasks already at the target or in later legitimate stages are ordinary no-ops, not errors.

The final whole-order Returned state is authoritative for the return path. Mixed-state detection protects the pickup path and partial operations that have not reached final Returned; do not reinterpret a final returned order as mixed solely because a non-returnable product remains picked up.

## Requirements inventory

### Functional requirements

- **FR1 — Pickup:** On a successful authoritative Booqable refresh that establishes the whole order is unambiguously picked up, advance each task currently Ready for Pickup to In Rental.
- **FR2 — Return:** On the same refresh path, when the fetched order has Booqable's final Returned state (`status = stopped`), advance each task currently In Rental to Returned. Do not independently recount or classify returned products. Booqable's handling of non-returnable products is authoritative.
- **FR3 — Existing stage guards:** Keep every other starting state unchanged by these two automatic transitions. Cancellation/removal behavior remains governed by the existing source-invalidation rules.
- **FR4 — Mixed orders:** Suppress automatic pickup/return for the entire mixed order before it reaches final Returned, even if some individual bike fulfillment states are identifiable. Final `status = stopped` follows FR2 even when non-returnable product states differ. Staff use the normal manual actions for partial operations. When a later refresh establishes full pickup or final Returned, advance only tasks still at the eligible local predecessor.
- **FR5 — Shared trigger behavior:** Webhook processing and task-level order refresh must evaluate the same transition rules. Completing a local checklist is not an additional trigger.
- **FR6 — Retry after blocked pickup:** A later Booqable refresh may apply a previously blocked pickup if the task is now Ready for Pickup and the whole order is still unambiguously picked up. Do not require a newly changed upstream status; an unchanged current source state can become actionable after local readiness changes.
- **FR7 — Manual recovery:** Keep the current manual pickup and return actions and their authorization, stage, and concurrency checks.
- **FR8 — Visibility:** Show a persistent task-page explanation when pickup/return automation is skipped because the order is mixed/ambiguous or the local stage conflicts with the uniform source target. A successful detail refresh must not misleadingly imply that every task advanced. Already-converged and legitimately later stages are not mismatches.
- **FR9 — Partner bikes:** Include existing Partner Bike tasks in uniform whole-order transitions under the same guards as tracked bikes. Do not attempt to assign partial quantities to synthetic tasks.
- **FR10 — Manual recovery after missed pickup:** A returned order does not automatically catch up a task that never reached In Rental; preserve its stage and show the agreed manual-recovery explanation.
- **FR11 — Reversals:** No automatic backward transitions or reopening. Show a mismatch for a known incompatible upstream reversal; normal mixed-order handling still applies when individual reversal cannot be established from aggregate data.
- **FR12 — Scope of refresh:** The task-level sync refreshes its entire order and evaluates all current associated tasks, consistent with the existing reconciliation operation. Apply the same rule to existing reconciliation callers without adding new sync schedules or widening the queue sync's source scope.

### Reliability and security requirements

- Evaluate and commit workflow changes in PostgreSQL under the existing order/task locking model. Concurrent manual actions and sync must not duplicate transitions or overwrite a later state.
- Replaying a snapshot after a transition must produce no duplicate transition event. Replaying it after local readiness changes must still evaluate FR6.
- Retain checklist values, signatures, and task identity. Record automatic transitions as source-driven events rather than attributing them to a mechanic who did not perform them.
- Continue to fetch authoritative order data after a webhook signal. Do not derive transitions from the event name alone. For pickup, preserve and validate aggregate fulfillment information needed to distinguish full pickup from mixed fulfillment; `order.status = started` alone is insufficient. For return, use the fetched final `order.status = stopped` as confirmed by the user.
- Preserve the complete-snapshot validation contract. Incomplete or failed fetches must not partially change tasks. Valid but ambiguous fulfillment must not be guessed into a uniform target state.
- Preserve existing staff authorization and sync environment restrictions. Author any database changes as idempotent migrations; hosted application is through the existing CI path.
- Keep this as one feature using the existing reconciliation path; no periodic polling or new background processing platform is proposed.

### UX requirements

- **UX-DR1:** Refresh the visible task status following a successful transition through the existing task UI update mechanism.
- **UX-DR2:** Reuse the existing task-page alert pattern to explain a blocked transition or mixed-order manual handling, including the relevant source state and current task stage. No new queue dashboard, notification channel, or mixed task status is required.
- **UX-DR3:** Preserve existing manual actions so staff can resolve missed transitions through the normal guarded workflow.

## Verified implementation context

These are repository observations from 2026-09-17, not proof of live deployment or current tenant configuration.

- `src/lib/workshop/domain/statuses.ts`: Workshop has individual bike statuses; no Mixed task status exists.
- `supabase/migrations/20260821120000_workshop_foundation.sql`: `workshop_mark_picked_up` requires Ready for Pickup, and `workshop_mark_returned` requires In Rental. M2 completion produces readiness with an attestation. Task commands use version checks and transition history.
- `src/app/api/webhooks/booqable/route.ts` and `src/lib/workshop/application/sync-env.ts`: accepted `order.*` deliveries identify an order and call reconciliation; the handler uses form-encoded webhook data as a signal.
- `src/lib/workshop/application/reconcile-order.ts`: reconciliation acquires an order lease, fetches and parses the source document, and applies a source snapshot in PostgreSQL.
- `src/lib/workshop/application/manual-sync.ts`, `syncTaskOrderFromBooqable`: the task button already refreshes the entire associated order after staff authorization. The P0 retains this scope.
- `src/lib/booqable/fetch-source-snapshot.ts`: the current include path already fetches `lines.planning.stock_item_plannings.stock_item`.
- `src/lib/booqable/parse-source-snapshot.ts` and `src/lib/workshop/domain/source-snapshot.ts`: assignments retain stock-item and planning identities but currently omit their fulfillment state; order parsing also currently omits aggregate `statuses`/`status_counts`. For the selected P0, aggregate fulfillment is the required addition, not individual bike fulfillment.
- `supabase/migrations/20260902140000_workshop_task_addons_scope.sql`: the latest retained-task reconciliation updates source details and checklist configuration; it does not perform pickup or return transitions.
- `src/lib/booqable/parse-source-snapshot.ts`: partner bikes without stock-item planning records receive synthetic identities from line ID and quantity. Individual partial fulfillment cannot safely be mapped to these synthetic units without another identity rule.
- The saved webhook cutover record lists `order.updated`, `order.started`, and `order.stopped` on the production endpoint as of 2026-08-31. The 2026-09-01 completion artifact records preservation of order subscriptions when customer events were added. Current live subscription configuration has not been checked in this planning session.

## Official Booqable evidence and remaining verification

The [API documentation](https://developers.booqable.com/#stock-item-plannings) describes stock-item planning state independently for each physical item, including `reserved`, `started`, and `stopped`. Partial return may leave the parent order `started`. Its [webhook endpoint documentation](https://developers.booqable.com/#webhook-endpoints) lists `order.updated`, `order.started`, and `order.stopped` and distinguishes form-encoded v1 from JSON v4 payloads. The [order workflow help article](https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow) explains the Mixed display for partial pickup.

The selected P0 retains individual Workshop task statuses and uses mixed order fulfillment only to suppress automation. Before implementation acceptance, verify refresh/event coverage when orders become uniformly picked up/returned and when they enter or leave a mixed state. Public documentation and the saved subscription list do not alone prove that coverage. This session has made no tenant API calls or webhook configuration changes.

User-reported UI observation: after selecting only some items for pickup, Booqable offers both pickup and return actions. This supports the operational possibility of simultaneous uncollected and collected items. The user explicitly does not guarantee the underlying order status; this observation is not captured API evidence. Keep the pickup requirement to prove full pickup from fetched aggregate fulfillment rather than assuming that a changed button or `status = started` means every item went out.

The [sales-item guidance](https://help.booqable.com/en/articles/5210103-how-to-track-sales-items) says sales items remain picked up because they are not expected back. The user clarified that Booqable itself resolves return selections and only reaches final Returned when the order's required returns are complete. The P0 therefore trusts the fetched final order state (`stopped`), without an independent product-return classifier. A representative integration test should confirm the UI-to-API mapping and ensure non-returnable products do not block Workshop return, but their individual statuses are not an additional product decision or transition prerequisite.

## Resolved product decisions and historical comparison

### D1 — Return observed before local pickup (confirmed)

Workshop can remain Ready for Pickup while the next refresh already reports the bike returned. The user confirmed that it must remain unchanged, explain the mismatch, and let staff use the existing manual flow to correct it. Do not add a two-stage automatic catch-up transition.

### D2 — Upstream reversals (confirmed)

The user confirmed that a reversed Booqable pickup or return must preserve the current Workshop stage and explain the mismatch. No automatic backward transitions or reopening completed work. Re-pickup of the same bike on the same assignment after a return is outside the two confirmed forward edges.

### D3 — Partner bikes without physical identities (resolved by P0 scope)

Partner Bike tasks participate when the entire order has unambiguous fulfillment. Mixed partner-bike orders stay manual, like every other mixed order. The earlier proposed exclusion of all partner-bike automation is superseded.

### D4 — Source granularity: whole order with mixed manual (selected)

The user selected the conservative whole-order option for MVP/P0: uniform orders automate and mixed orders stay manual. The comparison below records the reasoning; the other options are not current requirements.

The official [Orders fields documentation](https://developers.booqable.com/#orders) identifies `status` as simplified, with `statuses` and `status_counts` describing mixed fulfillment. The [stock-item planning fields](https://developers.booqable.com/#stock-item-plannings) explicitly allow an individual bike to remain reserved or become stopped while the parent order is started. Consequently, `order.status = started` is not proof that each bike is currently out with the customer.

Options considered:

- **Scalar order status only:** Easiest input mapping, but a partial pickup can advance an uncollected ready bike; a partial return can leave a returned bike In Rental until the overall order is stopped. Existing checklist guards do not detect these differences in physical fulfillment. A later order refresh could also advance a newly ready but uncollected bike while other bikes keep the order started.
- **Whole order only when fulfillment is unambiguous; mixed stays manual (selected):** Keeps the feature small and covers partner tasks. Pickup requires distinguishing full pickup from mixed fulfillment. Return trusts Booqable's final Returned order state. All existing local predecessor guards still apply independently. Tradeoff: partial operations get no automatic progression; non-bike items can defer full pickup. The later user clarification removes the proposed extra product-level return classifier.
- **Per-bike fulfillment:** Matches individual tasks and supports partial operations directly for tracked bikes. The current request already fetches the stock-item planning records; added work is preserving/validating their state and applying guarded transitions, rather than adding a request per bike. Synthetic partner-unit identity remains the separate unresolved case.

Any option must map an observed source state to one named eligible local transition; never interpret every order status change or webhook as an instruction to blindly advance one stage.

## Scenario checks for eventual acceptance criteria

- Fully picked-up order advances Ready for Pickup tasks; fully returned order advances In Rental tasks.
- Two of three bikes picked up or one of two rented bikes returned: mixed order produces no automatic pickup/return transitions; staff can use the manual flow.
- A uniform order includes an unfinished task: it stays in its stage while eligible sibling tasks advance.
- After mixed-order manual progression, a later uniform refresh advances only remaining eligible tasks, without reversing or duplicating the earlier manual transitions.
- Checks finish after a blocked pickup: no automatic transition on checklist completion; a later refresh of unchanged current Booqable pickup state can advance it.
- Normal manual pickup/return remains available.
- Pickup webhook missed and returned state observed later: preserve the local stage and show a mismatch for manual recovery.
- Booqable reverses an operation: preserve the local stage and show a mismatch; no automatic backward transition.
- Partner tasks lacking physical identities: uniform orders automate under existing guards; mixed orders stay manual.
- Non-returnable products remain picked up while the order is finally Returned: final `status = stopped` advances eligible In Rental tasks without requiring those products to stop.
- Pressing Returned without completing the order's required returns: no automatic Workshop return until the fetched order actually reaches final `stopped`.
- Zero-quantity options and non-bike items must not cause a false full-pickup decision. Use representative payloads when validating full-pickup versus mixed detection.
- Duplicate refresh, delayed webhook, concurrent manual transition, cancellation/removal, completed task, and invalid/incomplete snapshot preserve guards and history.

## Discussion record

- **2026-09-17 — Initial outline:** User requests one small standalone story covering webhook and task-sync automation, guarded transitions, and partial item operations; asks for clarification and historical context.
- **2026-09-17 — Clarification:** User confirms that only a later Booqable detail refresh should reconsider automatic pickup after checks complete; otherwise status stays as-is or mechanics advance manually as usual. User confirms the selected input sources.
- **2026-09-17 — Recovery decisions and scope exploration:** User confirms manual recovery for a missed pickup followed by return, and no automatic backward transitions for Booqable reversals. Partner-bike manual-only scope is not approved; user asks to compare order-wide status automation and its disadvantages.
- **2026-09-17 — P0 selected:** User accepts the option to automate only unambiguous whole-order pickup/return and keep mixed orders manual. Individual partial fulfillment automation is deferred; partner tasks are included in the uniform-order path.
- **2026-09-17 — Final return is authoritative:** User clarifies that Booqable determines whether return selections finish the order. Trust its resulting Returned order state; remove the extra item-by-item return check and the proposed non-returnable-product classification prerequisite.
- **2026-09-17 — Partial-pickup UI observation:** User reports simultaneous pickup and return buttons after selecting only some items for pickup, while explicitly remaining uncertain about the underlying order status. Record as UI evidence supporting mixed fulfillment, not live API verification. P0 requirements are unchanged.
- **2026-09-17 — Requirements confirmed:** User says “continue” at the requirements checkpoint, authorizing standalone story drafting with the selected P0 scope.
- **2026-09-17 — Workflow completed:** User approves the story and final validation with successive C selections, then confirms the closing checkpoint. The standalone story is ready for development; implementation has not started.

## Standalone grouping and coverage

The user's explicit request for one story without an epic replaces the skill's epic-list output and approval step. No epic is created and the existing project `epics.md` remains untouched. All twelve functional requirements, reliability/security requirements, and three UX requirements belong to the single user outcome: staff stop duplicating full-order pickup and return updates while retaining guarded manual handling for exceptions. No new prerequisite story or future epic is required.

Coverage: FR1–FR12 → standalone story `workshop-booqable-order-status-sync-p0`. The story maps these requirements to acceptance criteria and carries the implementation context needed for independent pickup.

Validated story: [Automatically advance Workshop tasks after full Booqable pickup or return](../stories/workshop/booqable-order-status-sync-p0.md). Its fourteen acceptance criteria cover all twelve FRs, the three UX requirements, and reliability/security constraints.

## Workflow state

Requirements, the single-story grouping, and the story are confirmed. Requirements coverage, architecture alignment, story quality, scope, and dependencies have passed planning validation. The user confirmed the final completion checkpoint, and the planning workflow is complete. The linked standalone story is ready for development. Technical payload/event verification remains an explicit implementation acceptance prerequisite. No feature code, database, or tenant configuration has been changed.
