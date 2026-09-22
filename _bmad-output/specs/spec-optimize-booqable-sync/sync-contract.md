# Shared sync contract

This feature delivers the shared selected-period capability. Dashboard UI and caller integration are delivered by the Dashboard task.

## Candidate selection

| Caller/scope | Eligibility |
|---|---|
| Workshop next seven days | Reserved orders with scheduled start on today through six days later in Europe/Madrid. |
| Workshop all reserved | All reserved orders; do not silently apply a date window. |
| Shared selected period (for Dashboard) | Reserved/started/stopped orders whose scheduled start OR scheduled return is in the selected Madrid period. Next Month means the next complete calendar month. |

Use an inclusive start instant and exclusive end instant calculated from Madrid local dates; handle DST. The Dashboard predicate is not rental-overlap search. Exclude new/draft/cancelled/archived orders from Dashboard membership, but still reconcile locally eligible stale candidates to discover their changed source state.

Union upstream discoveries with local IDs selected in PostgreSQL using the requested scope. Example: an order appears tomorrow locally but is moved next month upstream; it must be checked and removed from tomorrow's local membership. Preserve tasks/history according to existing reconciliation rules. Deduplicate by Booqable ID before work; failed or uncertain attempts remain retryable. Freeze range, timezone and status semantics for the run and validate resumed scope server-side; base64 cursor contents are not authorization.

Enumeration must prove completion using verified provider behavior. Missing top-level next links alone do not suffice: the experiment returned further list pages without them. Deduplication and stable ordering do not by themselves solve records moving between pages. Document coverage limits rather than promising a globally atomic provider snapshot.

## Result accounting

Keep one latest result per run/order and existing listed/succeeded/failed/skipped categories. Replacing failure with success must subtract failure and add success; the inverse and transitions to/from skipped must also be exact. Duplicates must not inflate totals. An unfinished cursor, failure or unknown coverage cannot advance a successful full-scope freshness label.

Choose batched result upserts plus one recount per checkpoint, or transactionally correct old/new result deltas, during implementation design. Do not move totals into JavaScript or trade correctness for speed. Check progress visibility and safe replay when apply commits but result recording is interrupted. Per-order atomic source apply remains intact; do not combine a month into one transaction or bypass work using an unproven fingerprint shortcut.

## Current code entry points

Baseline inspected: fb5dea705bf58dd14af964e872073e8f4aba4108. Recheck before implementation.

- src/lib/booqable/fetch-source-snapshot.ts: reserved pages of 50; detail graph fetch; retry handling.
- src/lib/workshop/application/manual-sync.ts and reconcile-order.ts: sequential processing, run/order leases and transactional apply.
- src/lib/workshop/domain/commands.ts: current date eligibility and v1 page cursor.
- src/lib/workshop/actions/sync-actions.ts: authenticated actions; database start/resume enforce staff access before the existing privileged worker.
- supabase/migrations/20260826120000_workshop_sync_retry_counters.sql: latest-result upsert plus full-run recount.
- 20260822120000_workshop_sync.sql, 20260821160000_workshop_source_apply.sql and 20260917124408_workshop_booqable_order_status_sync.sql: run functions, atomic apply and lifecycle guards.

No application files or SQL are changed by this spec. Preserve existing preview/staging restrictions. Any future migration is authored/applied locally; remote rollout follows the repository CI policy.
