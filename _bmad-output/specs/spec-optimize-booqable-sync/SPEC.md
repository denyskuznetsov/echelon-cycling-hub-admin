---
id: SPEC-optimize-booqable-sync
companions:
  - brownfield.md
  - sync-contract.md
  - verification.md
sources:
  - ../../research/booqable-sync-optimization/research.md
  - ../../research/booqable-sync-optimization/experiment/findings.md
---

# Optimize shared Booqable sync

## Why

Workshop's seven-day refresh scans unrelated reserved orders and can take too long. Dashboard already filters selected dates and saves progress between bounded actions, but both paths still recount accumulated results after every order. Reuse the delivered Dashboard infrastructure for both pages, reduce unnecessary listing and bookkeeping, and retire the full-sync execution path whose Workshop button was deliberately removed because it took too long.

## Capabilities

- **CAP-1**
  - **intent:** Staff can refresh Workshop's next seven days and Dashboard's selected dates efficiently and recover interrupted work without leaving stale local orders behind.
  - **success:** Workshop discovers reserved starts within its frozen Madrid seven-day window without scanning unrelated reserved orders; Dashboard retains reserved/started/stopped starts OR returns in its selected period, including Next Month. Both use shared run management, local stale-candidate checks and deduplicated recovery for runs created by the new implementation. Old unfinished runs are closed with history preserved; staff can start fresh. all_reserved execution is rejected without changing historical scope.
- **CAP-2**
  - **intent:** Staff see accurate sync progress and final totals with less database bookkeeping on both pages.
  - **success:** New results, duplicates and retry replacements produce exact listed/succeeded/failed/skipped totals without recounting the entire accumulated result set after every order.
- **CAP-3**
  - **intent:** The shared sync can refresh several orders from one detailed provider response when verified safe.
  - **success:** The batching gate in verification.md passes, normalized per-order outcomes match individual reads, and detail request count falls for the same input. If the gate is unproven or fails, CAP-1 and CAP-2 ship with individual reads; batching does not ship.

## Constraints

- Build on the delivered Dashboard discovery, saved candidates and continuation described in brownfield.md; consolidate run management and retain shared per-order reconciliation rather than creating another sync engine.
- Active page-level scopes are only Workshop next_7_days and Dashboard selected_period. Preserve their distinct recovery/freshness contracts and individual task refresh independently of page date ranges.
- Reject all_reserved starts, resumes and execution at server-action, worker and database boundaries; preserve historical scope values, rows and outcomes. Retire unfinished runs safely under sync-contract.md, never reinterpret them as seven-day runs.
- Preserve staff authorization, environment gates, fenced run/order leases, atomic per-order apply, task ownership/history, source notices and guarded lifecycle changes.
- Keep candidate selection over local tables and all result aggregation in PostgreSQL; do not bypass RLS in a new user-facing path.
- Preserve explicit failures and honest coverage; completion applies to the saved date interval. Partial, closed or older-window work must not assert a successful refresh of the current window.
- Never apply an incomplete batch graph or stale prefetched response; retain safe individual-read fallback. Dashboard work chunks are not evidence of bulk provider reads.

## Non-goals

- Restoring or optimizing All Reserved, deleting or relabeling its historical runs, rolling back its previously committed source/task changes, or redesigning either page's UI.
- Rebuilding Dashboard selected-period behavior already delivered; page/action wiring changes are limited to shared flow, recovery and feedback, including removal of legacy recovery paths.
- Reconstructing pre-update run progress, special worker-draining/cancellation infrastructure, or extra date-rollover UI.
- New Workshop lifecycle behavior, provider write-back, concurrency tuning, background queues, timestamp-based skipping or a general sync redesign.
- Application implementation, migrations, deployment, production sync or story breakdown during this spec update.

## Success signal

With identical deterministic input, both callers produce the required local order/task outcomes and exact retry-correct totals. Workshop avoids unrelated reserved-order listing and skip bookkeeping, both callers use shared resumable run management, and full-run recount work decreases. Fixtures prove all_reserved cannot start or resume, old unfinished runs close without losing history, fresh runs use the requested dates, and individual task refresh still works. Preserve stale-candidate repair and Dashboard coverage through Next Month. Verified batching additionally reduces detail requests. Record before/after work counts; no runtime percentage is promised.

## Assumptions

- listed counts unique candidates examined in the run; remote rows excluded by upstream filters are not counted as skipped.
