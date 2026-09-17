---
title: 'Automatically advance Workshop tasks after full Booqable pickup or return'
story_id: workshop-booqable-order-status-sync-p0
epic_id: null
status: ready-for-dev
priority: P0
created: '2026-09-17'
requirements: [FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12]
hard_dependencies: []
workflow: bmad-create-epics-and-stories
currentStep: complete
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
validationOutcome: passed
workflowComplete: true
requirementsConfirmed: true
storyApproved: true
implementationStarted: false
inputDocuments:
  - '../../requirements/booqable-workshop-pickup-return-sync.md'
  - '../../../specs/spec-automating-mechanics-daily-work/SPEC.md'
  - '../../../specs/spec-automating-mechanics-daily-work/workflow-state-machine.md'
  - '../../../specs/spec-automating-mechanics-daily-work/booqable-reconciliation.md'
  - '../../architecture/architecture-echelon-cycling-hub-admin-2026-08-20/ARCHITECTURE-SPINE.md'
---

# Standalone story: Automatically advance Workshop tasks after full Booqable pickup or return

As a Workshop staff member,
I want eligible bike tasks to advance when Booqable confirms a complete order pickup or return,
So that I do not repeat those updates in Workshop, while checklist guards and manual handling of partial operations remain available.

**Epic:** None. This story delivers one complete P0 feature using the existing Workshop reconciliation flow. It has no dependency on another new story.

**Requirements:** [Confirmed requirements and decision history](../../requirements/booqable-workshop-pickup-return-sync.md).

## Scope and settled decisions

Webhooks and **Sync order details from Booqable** fetch the authoritative order and apply the same rules to all current tasks for that order. Both tracked bikes and existing synthetic Partner Bike tasks participate.

| Fetched Booqable state | Eligible current Workshop state | Result |
|---|---|---|
| Full pickup, proven by aggregate fulfillment information | Ready for Pickup | In Rental |
| Final Returned order: `order.status = stopped` | In Rental | Returned |
| Partial pickup/return or other mixed fulfillment before final Returned | Any | No automatic pickup/return; manual flow remains available |
| Pickup completeness cannot be established | Any | No automatic pickup; explain why |
| Full pickup but local preparation is unfinished | Earlier preparation stage | No transition; explain mismatch |
| Final Returned but local pickup was never recorded | Ready for Pickup or earlier | No transition; explain manual recovery |
| Upstream reversal | Locally later stage | No backward transition |
| Any | Completed or Cancelled | No reopening or pickup/return transition |

The final order Returned state is authoritative. Do not require sales/consumable products to become returned or reclassify a returned order as mixed solely because those products remain picked up. Pressing a Booqable button or receiving a named webhook alone is not proof of the resulting order state.

Local guards apply independently: an unfinished task does not block eligible sibling tasks. Readiness still comes exclusively from the existing M1/M2 flow; synchronization does not complete checklist items or create signatures. Completing checks alone never invokes automatic pickup. A later refresh may reconsider the same unchanged upstream state.

The accepted operational tradeoff is that a partially returned bike stays In Rental until staff mark it returned manually or Booqable later completes the whole order return. Staff can then start storage preparation normally. P0 does not identify which individual bikes moved during a partial operation.

## Acceptance criteria

### AC1 — Full pickup advances only ready tasks

**Given** an authoritative complete order snapshot proves full pickup, and its tasks include Ready for Pickup and earlier preparation stages,
**When** reconciliation applies that snapshot,
**Then** only Ready for Pickup tasks move to In Rental,
**And** earlier tasks, their checklist values, and their attestations remain unchanged; eligible siblings are not blocked by them.

### AC2 — Final order return is authoritative

**Given** the fetched order has `status = stopped` and tasks include In Rental, Returned, and Prepare for Storage,
**When** reconciliation applies it,
**Then** only In Rental tasks move to Returned,
**And** other legitimate later stages remain unchanged,
**And** non-returnable products still marked picked up do not block this transition or trigger an item-level recount.

### AC3 — Partial operations remain manual

**Given** two of three items have been picked up, or one of several rented items has returned while the order has not reached final Returned,
**When** a webhook or manual refresh obtains mixed fulfillment,
**Then** no task receives an automatic pickup or return transition, even if individual tracked-bike states are available,
**And** the normal manual actions remain available under their existing guards,
**And** a later refresh confirming full pickup or final return advances only tasks still at the applicable predecessor, without duplicating earlier manual transitions.

### AC4 — Partner Bike tasks use the same rules

**Given** an order contains Partner Bike tasks created from line quantity without physical stock-item identities,
**When** its full pickup or final return is confirmed,
**Then** those tasks advance under the same local guards as tracked-bike tasks,
**And** a mixed order never assigns a partial quantity to an arbitrary Partner Bike task.

### AC5 — Readiness alone does not retry; a later refresh does

**Given** full pickup was previously observed while a task was Needs Re-check,
**When** the mechanic completes the existing signed checks,
**Then** the task reaches Ready for Pickup and stays there without an automatic source-driven transition,
**And when** a later authoritative refresh still confirms full pickup,
**Then** it moves to In Rental even though the upstream status or source fingerprint may be unchanged,
**And** if that refresh instead shows mixed fulfillment or a reversal, it does not apply a remembered pickup intent.

### AC6 — Missed pickup cannot be automatically skipped

**Given** a task is Ready for Pickup or earlier and the next fetched order state is final Returned,
**When** synchronization runs,
**Then** the task stays at its current stage,
**And** neither a direct jump to Returned nor a synthetic pickup-then-return sequence occurs,
**And** the task explains that staff must use the normal guarded manual flow to resolve the missed pickup.

### AC7 — Reversals preserve Workshop progress

**Given** stored prior source evidence and the latest fetched order establish an upstream reversal incompatible with the task's current stage, such as a previously fully picked-up order returning to Reserved while its task is In Rental,
**When** synchronization runs,
**Then** the task does not move backward and its checklist/signature history is preserved,
**And** the active task displays a mismatch for manual attention,
**And** an ordinary local manual transition ahead of Booqable is not falsely described as a proven upstream reversal; mixed fulfillment uses the mixed-order explanation.

### AC8 — Webhooks and task sync converge on the whole order

**Given** the same source snapshot and starting task states,
**When** processing it through an accepted order webhook or an authorized task's **Sync order details from Booqable** action,
**Then** the resulting task transitions are identical for every associated task, including siblings of the opened task,
**And** existing callers of the shared reconciler apply the same policy without adding schedules or expanding which orders the queue sync lists,
**And** refreshed task and queue views show the persisted result through the existing refresh mechanisms.

### AC9 — Normal manual flow remains usable

**Given** an authorized staff member and a task at a valid local predecessor,
**When** they use the existing manual pickup or return action,
**Then** it continues to work in full, mixed, and source-mismatch cases without requiring a Booqable write or another sync,
**And** invalid local starting stages, missing/expired sessions, unauthorized roles, and stale versions retain their existing handling.

### AC10 — Replays and races preserve one transition

**Given** duplicate refreshes, a late webhook that fetches current source state, or a concurrent manual task action,
**When** they contend to change the same task,
**Then** the existing leases, task locks, and version checks prevent overwriting later work,
**And** each actual automatic status change increments the task version once and appends one source-attributed transition event,
**And** a no-op replay adds no transition event, while unchanged-source retries after new local readiness remain possible as in AC5.

### AC11 — Source invalidation and terminal history take precedence

**Given** an order cancellation, removed/replaced bike assignment, or an already Completed/Cancelled task,
**When** reconciliation runs,
**Then** existing invalidation and terminal-state rules take precedence over pickup/return automation,
**And** replacement or newly discovered tasks start through the existing preparation flow without inheriting another task's work or skipping preparation because the order is already started/stopped.

### AC12 — Ambiguous and failed source reads never invent pickup

**Given** a structurally valid source snapshot whose pickup completeness is unknown, missing, or contradictory,
**When** reconciliation evaluates pickup,
**Then** it does not infer full pickup from `status = started`, a webhook name, an empty set, or zero counts; the task explains that automation could not establish full pickup,
**And given** a failed fetch or a structurally invalid/incomplete required snapshot,
**When** source validation fails,
**Then** the existing apply-nothing contract and explicit sync error are preserved,
**And** the final `status = stopped` return rule does not acquire an additional product-level pickup/return completeness requirement.

### AC13 — Staff can understand an automatic no-op

**Given** an active task whose latest persisted source state is mixed/unknown, conflicts with its required predecessor, or proves an upstream reversal,
**When** staff open or refresh the task,
**Then** a persistent task-page message explains the situation and the available manual action,
**And** it survives a page reload, updates or clears when the mismatch resolves, and distinguishes successful detail refresh from task advancement,
**And** already-converged tasks and legitimate later storage stages do not show false mismatch warnings.

### AC14 — Source contract and authorization are verified

**Given** the existing authenticated sync entry point, webhook receiver, and aggregate Booqable fields,
**When** the feature is verified,
**Then** representative full-pickup, partial-pickup, partial-return, and final-return payloads establish the precise pickup predicate and final-return mapping,
**And** denied staff calls cause no upstream request or task mutation, webhook authentication/environment gates remain effective, and the new transition capability is not exposed as an unauthorized public RPC,
**And** event coverage and subscription evidence are reported separately from local fixture/DB results; absent live evidence is not represented as a passing live integration check.

## Minimal implementation path and constraints

1. **Establish the source contract within this story.** The documented fields to inspect are `orders.status`, `orders.statuses`, and `orders.status_counts`. Full pickup needs positive evidence that the whole order's fulfillment is picked up with no remaining reserved/returned fulfillment; `started` alone is insufficient. Do not narrow pickup completeness to bikes or workshop-tagged products. Validate how zero-quantity options and non-bike items appear. Preserve the chosen exact predicate and sanitized representative payloads in tests. Trust final `stopped` for return. Do not guess field defaults or treat the user's button observation as captured API data.
2. **Extend the existing snapshot and apply transaction.** Preserve and validate required raw aggregate fields in the Booqable adapter/domain envelope. PostgreSQL owns any aggregation/classification, task selection, guard evaluation, and status mutation. Extend existing persistence/read models only as needed for replay, source evidence, and the task-page message. Use the existing order → assignment → task lock order, task version bumps, and source event convention. Preserve prior source evidence before replacement if needed to identify a reversal. Do not add a parallel order store or a general event-processing framework.
3. **Keep shared reconciliation and auth boundaries.** Both entry points already converge; place the new rule at that shared application/database boundary. Do not simply call staff RPCs from a webhook without the required actor context, impersonate a signer, add broad grants, or broaden privileged access. Review the existing staff role/task visibility checks before the service-backed sync path; preserve the repository's authenticated RLS and `withAuth` requirements.
4. **Add one task-page explanation.** Reuse the existing Alert component and task DTO/loader patterns. Example mixed-order copy: “This Booqable order has partial pickups or returns. Update this task manually.” Example readiness copy: “Booqable marks this order as picked up. Finish the checks, then sync again or mark this task as picked up.” Normal no-ops are not failures; fetch/apply errors remain explicit errors. Use the existing refresh mechanism; do not add polling.

Read `AGENTS.md` before implementation. Create any migration using the established CLI workflow, make it idempotent, and apply it only to the local stack. Hosted migrations go through branch CI. Do not reset local data without explicit approval. This planning task authorizes no tenant reads, provider writes, production changes, or deployment. Any later live verification uses separately authorized narrow access, with secrets/PII kept out of artifacts.

## Current implementation entry points

All paths below are relative to the repository root. Inspect the current versions when starting implementation; this is repository evidence captured on 2026-09-17.

| Concern | Existing location |
|---|---|
| Source fetch and parser | `src/lib/booqable/fetch-source-snapshot.ts`, `src/lib/booqable/parse-source-snapshot.ts` |
| Snapshot validation/types | `src/lib/workshop/domain/source-snapshot.ts` |
| Shared order reconciliation | `src/lib/workshop/application/reconcile-order.ts` |
| Task sync and staff authorization | `src/lib/workshop/application/manual-sync.ts` (`syncTaskOrderFromBooqable`), `src/lib/workshop/actions/sync-actions.ts` |
| Webhook routing/environment gates | `src/app/api/webhooks/booqable/route.ts`, `src/lib/workshop/application/sync-env.ts` |
| Apply, leases, event recording | `supabase/migrations/20260821160000_workshop_source_apply.sql`, `20260822120000_workshop_sync.sql` |
| Latest retained-task sync and detail model | `supabase/migrations/20260902140000_workshop_task_addons_scope.sql` |
| Existing pickup/return commands | `supabase/migrations/20260821120000_workshop_foundation.sql` |
| Task interface/read contracts | `src/app/workshop/_components/WorkshopTask.tsx`, `src/lib/workshop/data/tasks.ts`, `src/lib/workshop/domain/dtos.ts` |
| Existing verification | `src/booqable-source-apply.test.mts`, `src/workshop-sync.test.mts`, `src/workshop-ui.test.mts`, `supabase/tests/database/workshop_source_apply.test.sql`, `workshop_sync.test.sql`, `workshop_foundation.test.sql` |

The parser currently retains simplified order status but discards `statuses`/`status_counts`; the source apply currently updates retained task details without pickup/return progression. The full order include already exists. Partner tasks use synthetic line/quantity identities, which need no new individual matching for this P0.

## Verification plan

- **Source contract:** Capture or obtain authorized sanitized representative source payloads and webhook evidence. Record full pickup versus mixed detection, final `stopped`, non-returnable products, and zero-quantity options. Existing subscribed events are historically `order.updated`, `order.started`, and `order.stopped`; verify current configuration and actual required deliveries without assuming the 2026-08-31 record is current. Do not alter subscriptions as part of this planning task.
- **Adapter and database:** Exercise the actual snapshot → apply path for every matrix row; include both synthetic partner and tracked tasks. Verify same-source retry after M2, cancellation precedence, new task creation, duplicate history, and a meaningful concurrent manual/sync transition. Assert preserved signatures and no unauthorized RPC access. Verify idempotent local migration replay without destructive data reset.
- **UI and recovery:** Verify the task-page message persists across reload, resolves with the condition, and the manual buttons remain usable for mixed orders. Exercise a missed pickup followed by final return and a known upstream reversal. Check visible task/queue refresh after actual transitions.
- **Existing checks:** Run relevant `npm run test:source-apply`, `npm run test:workshop-sync`, `npm run test:workshop-ui`, `npm run test:db`, TypeScript, and focused ESLint. Current scripts use Node's test runner; do not assume the older architecture document's proposed Vitest setup is installed.

No tests have been run for feature implementation in this planning task, and no live subscription or payload verification has been performed. Local test success, rendered UI evidence, and live Booqable evidence must be reported separately at completion.

## Requirement coverage

| Requirement | Acceptance criteria |
|---|---|
| FR1 full pickup | AC1, AC12 |
| FR2 final return | AC2 |
| FR3 stage guards | AC1, AC2, AC6, AC11 |
| FR4 mixed/manual policy | AC3 |
| FR5 shared triggers | AC5, AC8 |
| FR6 later refresh retry | AC5, AC10 |
| FR7 manual recovery | AC6, AC9 |
| FR8 visibility | AC12, AC13 |
| FR9 partner tasks | AC4 |
| FR10 no missed-stage catch-up | AC6 |
| FR11 reversals | AC7 |
| FR12 order-wide scope | AC8 |
| UX-DR1 visible result refresh | AC8 |
| UX-DR2 persistent explanation | AC6, AC7, AC12, AC13 |
| UX-DR3 retained manual actions | AC3, AC9 |
| Reliability, history, source validation, security | AC10, AC11, AC12, AC14 |

## Scope exclusions

Individual partial-operation automation; a Mixed Workshop task status; automatic backward transitions or stage skipping; automatic progression upon checklist completion; Booqable write-back; per-partner-unit identity changes; new sync schedules, queues, or notification systems; a new queue-wide mismatch dashboard; automatic storage preparation or completion; historical bulk backfill; unrelated external integration changes.

## Source evidence and historical contract change

The original [Workshop contract](../../../specs/spec-automating-mechanics-daily-work/SPEC.md) and [state machine](../../../specs/spec-automating-mechanics-daily-work/workflow-state-machine.md) made pickup/return manual. This story explicitly supersedes that non-goal for the two agreed source-driven forward edges. All other checklist, identity, cancellation, terminal-state, and storage rules remain binding. Implementation should update the affected CAP-7/non-goal and architecture statements to avoid leaving contradictory instructions.

Official references: [order fields and statuses](https://developers.booqable.com/#orders), [webhook events](https://developers.booqable.com/#webhook-endpoints), [partial-operation UI behaviour](https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow), and [non-returnable sales items](https://help.booqable.com/en/articles/5210103-how-to-track-sales-items). Source fields and webhook names are documented; current tenant delivery/configuration is not verified here. The user confirms that final Returned is authoritative and reports simultaneous pickup/return buttons after partial pickup without guaranteeing the raw API status.

## Review and completion record

Requirements were confirmed with “continue” on 2026-09-17; the user then approved progression from story review with “C”. Final planning validation passed on 2026-09-17, and the user confirmed workflow completion with the final “C”. Planning is complete and this story is ready for development. Implementation has not started; the bounded source-contract and webhook checks remain part of implementation acceptance.

| Validation area | Result |
|---|---|
| Functional and UX coverage | Pass: all twelve FRs and three UX requirements have explicit AC coverage; no uncovered requirement found. |
| Architecture and data ownership | Pass: shared complete-snapshot reconciliation, PostgreSQL-owned guards/calculation, atomic history/versioning, existing auth boundaries, and local-only migrations are retained. The changed manual-only historical policy is explicitly superseded. |
| Existing project setup | Pass: this extends the current application; no starter project, framework upgrade, or unrelated database setup is required. Current test scripts were checked against `package.json`. |
| Story quality and size | Pass: one complete user outcome with fourteen testable Given/When/Then criteria, bounded source-contract verification, implementation entry points, and a verification plan. No new platform or independent feature is included. |
| Epic structure and file overlap | Not applicable as an epic: the user explicitly requested one standalone story. It contains the shared adapter/database/UI work together, avoiding artificial splits across those same files. |
| Dependencies | Pass: no dependency on a future story or individual partner-bike identity feature; required source verification is included within this story. |
| Consistency and artifact checks | Pass: final Returned takes precedence over differing non-returnable product states; mixed operations otherwise remain manual; source guards, manual recovery, and no-backward rules agree. Local references, AC numbering, requirement mappings, whitespace, and placeholder checks pass. |
| Evidence boundary | Planning validation only. No feature implementation, automated feature tests, browser verification, or live Booqable verification is claimed. |

At implementation completion, record the precise pickup predicate, source/event evidence, migration and changed files, local/DB/UI verification, residual limitations, and final story status. Keep this story independently usable without requiring the reader to reconstruct the discussion.
