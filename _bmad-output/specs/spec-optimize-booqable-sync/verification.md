# Verification and deferred options

## Required checks for CAP-1 and CAP-2

- Workshop discovery: upstream reserved/start-date predicates, no matches, exact lower/upper bounds, Madrid DST, retry across midnight, duplicate IDs, local cancellation/date moves and multiple list pages. Many unrelated reserved orders must demonstrate avoided listing and skip bookkeeping.
- Dashboard regression: starts-only, returns-only, both dates, reserved/started/stopped, Next Month, archive exclusion and local stale candidates. Preserve two discovery passes and exact-date recovery through shared infrastructure.
- Continuation: both callers traverse multiple discovery pages and work chunks; successful candidates are not unnecessarily repeated, failed/uncertain active-scope work remains retryable, and interruptions preserve run ID, frozen scope and progress. Test navigation stopping future chunks, compatible new-format saved runs, scope/policy mismatch rejection and distinct freshness history. Both controls must drive shared run management.
- Accounting: first success/failure/skip, duplicate, failed-to-success, success-to-failed, skip transitions, concurrent recording and interrupted apply/result recording. Final totals must equal authoritative latest per-order outcomes for both callers.
- Regression: authorization/environment denial, stale run/order lease rejection, task ownership and assignment history, complete snapshot validation, partner units, source notices and guarded fulfillment transitions remain intact. Individual task refresh still resolves and reconciles its order, including orders outside both page ranges, with existing role/environment checks.
- Compare deterministic current/optimized list calls, detail calls, result RPCs and full-run recount work, including completion bookkeeping. CAP-1/CAP-2 may retain the same detail request count; only verified CAP-3 claims fewer detail requests. Existing source-text assertions are not sufficient behavior tests.
- Check deployed action duration and database role/function limits before rollout; neither ten orders per action nor local simulations prove compliance. No verified live end-to-end timing or speedup exists. Do not run live probe scripts as ordinary tests or use Sync as a read-only benchmark.

## Old-run transition and date handling

- Encounter an unfinished pre-update run with a page greater than one, recorded successes/skips and no frozen date bounds. Close it unsuccessfully once, preserve its history, and require a fresh active-scope sync. Do not reuse its page offset, results or inferred dates. Repeating the request must not reopen or duplicate the closed run.
- The fresh run begins discovery at page one with a new run ID, current requested dates and independent counters. Completed historical runs stay unchanged. An all_reserved request must fail without creating a substitute run.
- New-format same-interval runs resume normally. A Workshop run started before Madrid midnight keeps its original interval until completion; a new click after midnight targets the new seven-day interval. Older or unknown intervals do not assert current-window coverage. Dashboard continues to use the exact selected period.
- Reuse existing lease/busy behavior if a run is still active; after interruption/expiry it can be closed safely. Confirm closed runs reject subsequent resume/result/finish calls and closure does not release unrelated locks. No dedicated worker-draining or progress-reconstruction mechanism is required.

## all_reserved retirement acceptance

- Reject direct server-action starts, forged/old resume cursors, direct worker dispatch and direct public/private database start/resume calls for all_reserved before provider work or new run/lease creation. A next_7_days argument with an all_reserved run ID must fail. No silent conversion, substitute run or restored full-sync control is allowed.
- Upgrade fixtures include succeeded, failed and in_progress legacy runs; unfinished failed runs with cursors/missing completion times; populated per-order results; and histories containing only all_reserved successes. Preserve run IDs, scope, counters, results, prior errors/timestamps and inert cursor evidence. Mark in_progress runs failed, retain failed outcomes, add non-destructive retirement evidence, and make all of them non-resumable. Repeating retirement must not duplicate evidence or change its original retirement time/outcomes.
- Historical scope reads and the storage CHECK continue to accept preserved all_reserved rows while execution validators reject them. No deletes, cascading result loss, scope relabeling, fabricated order failures or rollback of earlier source/task updates.
- Retirement never uses the normal success-finishing branch or advances last-success time. Legacy runs cannot appear as active pending/recovery work or keep the UI busy. Workshop reports coverage only from next_7_days evidence matching the relevant saved interval; Dashboard retains its selected-period evidence. Mixed legacy cached health must not fabricate current-window coverage.
- Fresh seven-day and selected-period runs, compatible new-format recovery, and individual task refresh work after retirement. Keep authorized historical reads available. Verify idempotent local migration replay and preserved history before rollout through CI.

## CAP-3 batching evidence and acceptance gate

Dashboard currently reconciles up to ten orders per action with sequential individual detail fetches. This proves neither completeness nor equivalence of bulk provider responses.

The authorized research experiment made 20 read-only HTTP requests. Ordinary order lists omitted lines/allocations despite includes. POST /api/4/orders/search with a simple comma-separated ID filter returned three reserved orders with matching related-resource sets: 31 lines, 30 plannings and one stock allocation/item. Two complete graphs matched; one primary order differed for an unknown reason. Nested OR-on-ID search returned 400; its cause was not recorded. This does not disprove documented OR-on-date search. Child endpoints returned matching sample lines/allocations but line listing omitted products/deep allocation includes. A bounded date-filtered list returned three in-range rows; it did not establish completeness or boundary correctness.

User decision: include bulk detail fetching only if the following checks pass; otherwise ship CAP-1/CAP-2 with individual reads. Missing evidence is not a reason to block those two capabilities.

Before adopting search batching: identify differing field paths without saving values, compare normalized snapshots, test multiple allocations, started/stopped/mixed fulfillment, shared products/customers, partner units, removed/reassigned bikes and forced search/nested pagination. Establish completeness against independently known fixtures or a provider guarantee; parity with detail responses alone cannot prove neither omitted data. Reject incomplete graphs explicitly.

Take order leases before authoritative bulk fetching or establish a verified equivalent freshness mechanism; prefetched data must not overwrite newer reconciliation. Define fallback for unsupported/partial results and safe provider batch size after evidence, not from the three-order experiment or Dashboard's ten-order chunk. Exact tenant quota and page caps remain unknown. Preserve per-order atomic apply and result/retry isolation. Demonstrate fewer detail requests and equivalent outcomes for the same fixtures through both active caller scopes.

Single request timings are not a performance claim. Preserve TLS verification and retain only sanitized counts/comparisons or differing field paths, never credentials or raw customer payloads. Live experiment access requires its own authorized scope; this documentation update does not authorize tenant calls.

## Deferred, not accepted requirements

- Concurrency: overlap independent orders only; preserve same-order leases, account for shared customer/run locks and other webhook/task workers. A local pool does not enforce a cross-instance quota. Honor Retry-After; never use unlimited parallel requests.
- Autonomous background execution: existing client-driven bounded continuation is accepted reuse scope; background jobs remain a separate decision. Any later concurrent continuation design must bound time/order count and drain workers before checkpointing.
- Incremental skipping: require child-change coverage for allocations, quantities, tags, customer/coupon and fulfillment, deletion/archive handling, durable watermarks with tie-breaking/overlap and full-refresh fallback. Order updated_at and current webhook handling alone do not establish that guarantee.

These deferred options preserve research findings; downstream work must not silently add them to this feature.
