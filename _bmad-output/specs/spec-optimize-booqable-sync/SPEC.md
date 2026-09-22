---
id: SPEC-optimize-booqable-sync
companions:
  - sync-contract.md
  - verification.md
sources:
  - ../../research/booqable-sync-optimization/research.md
  - ../../research/booqable-sync-optimization/experiment/findings.md
---

# Optimize shared Booqable sync

## Why

Workshop refresh is already slow for seven days. Dashboard refresh will cover larger periods and incoming orders. Reduce unnecessary provider reads and database bookkeeping while preserving the order and Workshop results staff rely on.

## Capabilities

- **CAP-1**
  - **intent:** Staff can refresh orders relevant to a selected period, including Next Month, through the shared sync without scanning unrelated orders or leaving stale local orders behind.
  - **success:** Selected-period refresh checks reserved/started/stopped orders whose scheduled start OR return falls in the Madrid period, plus locally eligible stale candidates. Existing Workshop scopes retain their eligibility. Candidates are checked once per successful pass; moved/cancelled orders are reconciled and date boundaries are correct.
- **CAP-2**
  - **intent:** Staff see accurate sync progress and final totals with less database bookkeeping.
  - **success:** New results, duplicates and retry replacements produce exact listed/succeeded/failed/skipped totals without recounting the entire accumulated result set after every order.
- **CAP-3**
  - **intent:** The shared sync can refresh several orders from one detailed provider response when verified safe.
  - **success:** The batching checks in verification.md pass, normalized per-order outcomes match individual reads, and detail request count falls for the same input. If verification fails, CAP-1 and CAP-2 retain individual reads; batching does not ship.

## Constraints

- This feature delivers selected-period support in the shared sync; Dashboard UI and caller integration belong to the Dashboard task.
- Preserve existing Workshop scopes and the selected-period semantics in sync-contract.md.
- Preserve staff authorization, environment gates, fenced order leases, atomic per-order apply, task ownership/history and guarded lifecycle changes.
- Keep candidate selection over local tables and all result aggregation in PostgreSQL; do not bypass RLS in a new user-facing path.
- Preserve retry/recovery behavior, explicit failures and honest coverage; partial work must never be reported as a completed refresh.
- Never apply an incomplete batch graph or stale prefetched response; retain safe individual-read fallback.

## Non-goals

- Dashboard UI/integration, new Workshop lifecycle behavior or provider write-back.
- Concurrency tuning, background queues, incremental timestamp-based skipping or a general sync redesign.
- Implementation, migrations, deployment, production sync or story breakdown during this spec task.

## Success signal

With identical deterministic input, the optimized path produces the same relevant local order/task outcomes and exact retry-correct totals, while issuing fewer irrelevant provider/list requests and fewer full-run recounts. Selected-period fixtures demonstrate outgoing and incoming coverage through Next Month. Verified batching additionally reduces detail requests. Record before/after counts; no runtime percentage is promised.

## Assumptions

- listed counts unique candidates examined in the run; remote rows excluded by the upstream date filter are not counted as skipped.
