---
title: Bounded external requests and independent sync outcomes
story_id: '1.9'
epic_id: '1'
review_recommendation: API-3
requirements: [FR9]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.9: Bounded external requests and independent sync outcomes

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review API-3](../../reviews/project-foundations-review-2026-09-15.md#api-3--standardize-external-request-failure-handling)

## User story

As an operator relying on external customer and order integrations,
I want requests to finish within known bounds and each destination's outcome to be recorded,
So that a slow or failed provider does not hide successful work or leave synchronization in an ambiguous state.

## Review context and evidence

Booqable retries up to three attempts but fetch calls have no explicit deadline and `Retry-After` can extend waits. Google, Holded, Mailchimp, PostHog, and Short.io have separate request handling without a common deadline/retry contract. `collectLandingStatuses` waits for every destination via `Promise.all`; only afterwards does `saveStatuses` persist all outcomes. A stalled destination therefore delays acknowledgement and persistence of others.

Entry points:

- `src/lib/booqable/fetch-source-snapshot.ts`: `booqableGetJson`, retry delay and pagination.
- `src/lib/customer-landing/{google,holded,mailchimp}.ts`: request helpers.
- `src/lib/customer-landing/{land-customer,landing-store,types}.ts`: destination orchestration and persisted status.
- `src/lib/posthog/traffic.ts`, `src/app/api/links/create/route.ts`, `src/lib/marketing-links-actions.ts`.
- `src/app/api/webhooks/booqable/route.ts`, `src/lib/workshop/application/{reconcile-order,manual-sync,sync-env}.ts`.
- Existing customer landing and Workshop sync tests; Workshop architecture AD-2/AD-10.

## Scope

- Establish a small reusable HTTP transport contract for explicit deadlines, bounded retries, safe error reporting, and injectable test transport across the six providers above.
- Preserve provider-specific authentication, payloads, pagination, idempotency/recovery, and response parsing in adapters.
- Persist customer destination results independently as each finishes, without one writer replacing another destination's outcome.
- Keep webhook processing awaited and bounded. Exclude a background queue, scheduler, detached promises, provider replacement, or automatic retry of unsafe side effects.
- SDK-managed transports, such as email SDK internals, are outside this HTTP-helper rollout unless current inspection identifies a directly shared request path.

## Acceptance criteria

### AC1 — Bounded requests

**Given** a provider stalls during connection, headers, or body reading, **When** its request exceeds the documented deadline, **Then** the operation settles with a meaningful timeout result and cleanup; **And** the enclosing request remains within its documented total execution budget.

### AC2 — Bounded and appropriate retries

**Given** a retryable network error, 429, or eligible 5xx response, **When** an operation is safe to retry, **Then** attempts and backoff remain within the total budget, jitter is applied where appropriate, and valid `Retry-After` is honored only within that budget; **And** permanent failures terminate without retry loops.

### AC3 — Side-effect safety

**Given** a timeout or ambiguous outcome for a create/update/delete operation, **When** recovery is considered, **Then** the adapter uses its established idempotency/reconciliation contract or surfaces uncertainty rather than blindly repeating an unsafe operation or declaring success.

### AC4 — Independent destination persistence

**Given** one customer destination succeeds, another fails, and a third is slow, **When** each result becomes known, **Then** that destination's ID/status/error is persisted independently and remains visible even while another destination is pending; **And** timeout/failure of the slow destination does not erase successful outcomes.

### AC5 — Concurrency and persistence failures

**Given** overlapping customer events or a database failure while saving a destination outcome, **When** handlers finish, **Then** stale/partial writes cannot replace newer or other-destination state, persistence failures are visible, and the agreed webhook retry/acknowledgement semantics preserve recoverability.

### AC6 — Existing order-sync invariants

**Given** Booqable order synchronization, **When** requests retry, time out, or return incomplete/invalid pages, **Then** no partial source snapshot is applied, lease/token/fence safeguards remain effective, and manual-sync cursor/progress/environment guards remain correct.

### AC7 — Consistent adoption and diagnosability

**Given** every scoped provider path, **When** success, timeout, permanent error, retry exhaustion, or malformed response is tested, **Then** the shared transport contract is used where applicable, adapter-specific meaning is retained, and logs/UI expose actionable context without credentials or raw sensitive payloads.

## Implementation notes and constraints

Read `AGENTS.md` and preserve established Workshop module boundaries. Do not infer production timeout limits from old README statements; verify current runtime budgets before choosing numbers. An aborted local request does not prove the remote side effect was rolled back. Keep service credentials in existing server-only adapters and user-facing reads under RLS.

Use partial destination updates and a concurrency strategy consistent with the current identity/sync model; changes to persisted status semantics or migrations belong to this story. Preserve environment write guards and do not send real customer data or mutate vendors in tests. Add only local-verified, forward, idempotent migrations if needed. Retry helpers must not hold a webhook open beyond its enclosing deadline or detach work after responding.

## Verification

- Inject fake transport/clock behavior for no response, slow bodies, 429/5xx, malformed `Retry-After`, permanent 4xx, retry exhaustion, and ambiguous side effects.
- Assert maximum attempts and total elapsed budget without real sleeping or vendor calls.
- Test one successful/one failed/one stalled destination and inspect persisted status during execution, not only at the end.
- Test overlapping events, partial persistence failure, and regression of Booqable snapshot completeness, lease fencing, manual resume, and webhook outcome semantics.

## Decisions at pickup

- Verify current hosting limits and choose per-provider/per-operation and total budgets with explicit rationale; the review supplies no numeric SLA.
- Classify retry safety and idempotency for each operation, including ambiguous vendor outcomes.
- Specify in-progress status visibility, timestamp semantics, concurrent-event ordering, and webhook acknowledgement behavior before changing the persistence contract.

## Independence and coordination

No hard dependency. Reuse existing adapters and own transport, status persistence, necessary migrations, and integration tests. Story 1.7 owns operation authorization; preserve it if already present. Story 1.8 owns generic typing/validation, while this story owns provider failure semantics and bounded execution.

## Completion record

Implementation has not started in this recording task. Record budget/retry policy, operation-safety matrix, destination persistence/concurrency contract, changed files, timing and regression evidence, residual limits, and final status; update the epic index.
