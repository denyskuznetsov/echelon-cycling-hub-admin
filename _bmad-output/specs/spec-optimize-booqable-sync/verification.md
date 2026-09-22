# Verification and deferred options

## Required checks for CAP-1 and CAP-2

- Candidate fixtures: no matches, exact lower/upper bounds, Madrid DST, duplicate IDs, stale local cancellation/date move and multi-page enumeration. Selected-period checks must cover starts-only, returns-only, both dates in range, started/stopped orders, next month and archive exclusion.
- Accounting fixtures: first success/failure/skip, duplicate, failed→success, success→failed, skip transitions, concurrent recording and interrupted apply/result recording. Final totals must equal authoritative latest per-order outcomes.
- Regression: authorization/environment denial, stale lease rejection, task ownership and assignment history, complete snapshot validation, partner units and guarded fulfillment transitions remain intact.
- Compare deterministic baseline/optimized list calls, detail calls, result RPCs and full-run recount work. Include many unrelated orders so avoiding them is demonstrated. Existing source-text assertions are not sufficient behavior tests.
- Check deployed action duration and DB role/function limits before rollout; no verified limits or live end-to-end timing exist. Simulated delay and request counts are not production speed measurements. Do not run live probe scripts as ordinary tests or use Sync as a read-only benchmark.

## CAP-3 batching evidence and acceptance gate

The authorized experiment made 20 read-only HTTP requests. Ordinary order lists omitted lines/allocations despite includes. Search with a simple comma-separated ID filter returned three reserved orders with matching related-resource sets: 31 lines, 30 plannings and one stock allocation/item. Two complete graphs matched; one primary order differed for an unknown reason. Nested OR-on-ID search returned 400; its cause was not recorded. This does not disprove documented OR-on-date search. Child endpoints returned matching sample lines/allocations but line listing omitted products/deep allocation includes.

User decision: include batching only if the following checks pass; otherwise ship CAP-1/CAP-2 with individual reads.

Before adopting search batching: identify differing field paths without saving values, compare normalized snapshots, test multiple allocations, started/stopped/mixed fulfillment, shared products/customers, partner units, removed/reassigned bikes and forced search/nested pagination. Establish completeness against independently known fixtures or a provider guarantee; parity with detail responses alone cannot prove neither omitted data. Reject incomplete graphs explicitly.

Take order leases before authoritative bulk fetching or establish a verified equivalent freshness mechanism; prefetched data must not overwrite a newer reconciliation. Define fallback for unsupported/partial results and safe batch size after evidence, not from this three-order sample. Exact tenant quota and page caps remain unknown. Single request timings are not a performance claim.

## Deferred, not accepted requirements

- Concurrency: overlap independent orders only; preserve same-order leases, account for shared customer/run locks and other webhook/task workers. A local pool does not enforce a cross-instance quota. Honor Retry-After; never use unlimited parallel requests.
- Durable continuation: if later adopted, bound time and order count, drain workers before checkpoint, retain pending/completed/failed evidence, and disclose that client-driven continuation stops on navigation. Background autonomous execution is a separate decision.
- Incremental skipping: require child-change coverage for allocations, quantities, tags, customer/coupon and fulfillment, deletion/archive handling, durable watermarks with tie-breaking/overlap and full-refresh fallback. Order updated_at and current webhook handling alone do not establish that guarantee.

These options remain recorded to preserve research findings; downstream work must not silently add them to this feature.
