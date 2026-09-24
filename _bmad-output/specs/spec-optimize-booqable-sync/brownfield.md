# Current implementation and remaining work

Inspected 2026-09-24 at staging commit `7a6f9d3883b490b543f364fd1e364b96a6e72471`; that commit imported research, while application changes are through `efeee06`. Recheck these entry points before implementation. Historical research used `fb5dea7` and does not describe the later Dashboard additions.

## Confirmed code behavior

| Area | Workshop Next 7 Days | Dashboard selected period |
|---|---|---|
| Discovery | Lists reserved orders in pages of 50, filters starts in application code, records out-of-window rows as skipped | Lists starts and returns separately with upstream date bounds; application checks dates and reserved/started/stopped status |
| Local candidates | No separate local candidate capture in this path | PostgreSQL captures locally eligible orders at run start and unions/deduplicates discovered IDs |
| Continuation | Initial seven-day action walks all pages; v1 recovery stores scope/page/run ID | Saves exact Madrid bounds, policy, discovery phase/page and candidates; each action lists one page or reconciles up to ten orders |
| Detail and apply | Sequential calls to shared reconcileBooqableOrder | Same sequential per-order function; ten IDs are a work chunk, not one Booqable detail response |
| Accounting | Latest per-order result then full-run recount | Dashboard wrapper delegates to the same recount function |
| UI | Only Sync next 7 days | Selected-date Sync automatically starts or resumes and continues actions while mounted |

The shared reconciliation path acquires an order lease, fetches GET /api/4/orders/{id} with detailed includes, parses, applies one order atomically and releases the lease. It does not use the research's POST /api/4/orders/search bulk detail approach. Individual task refresh performs its own authorized task-to-order lookup and calls that same reconciler.

## Legacy full-sync retirement findings

- MANUAL_SYNC_SCOPES, isManualSyncScope and the v1 cursor decoder still accept all_reserved; the action validates against that list and the worker dispatches the legacy reserved-page path.
- Public/private workshop_start_manual_sync and workshop_resume_manual_sync RPCs allow all_reserved. Resume checks scope equality but rejects only succeeded state, so failed runs remain executable today.
- Historical booqable_sync_runs storage allows next_7_days, all_reserved and selected_period. Its state model is in_progress/succeeded/failed. Per-order results reference run IDs with ON DELETE CASCADE, so deleting runs would destroy result history.
- booqable_finish_sync_run can mark a run succeeded when the cursor is null and no failures are recorded, then update the shared Workshop success timestamp. It takes no run token/fence, so clearing cursors or merely expiring leases is insufficient retirement protection.
- The latest Workshop health view still selects next_7_days and all_reserved, while last_success_at comes from a shared cache with mixed provenance. Active health/recovery must be scoped separately from retained history.
- Both page flows use the manual_sync run lock; per-order reconciliation has separate leases. Use existing busy/lease behavior when closing an interrupted run; do not release unrelated locks.

These are code/schema findings; no database run inventory was queried. The user reports roughly 400 orders and short sync runs. The agreed transition is therefore simple: close old unfinished runs when encountered, preserve history and let staff start fresh. Old seven-day cursors refer to the unfiltered list and have no frozen bounds; reconstructing their progress is out of scope.

## Remaining work

- CAP-1: generalize Dashboard's saved-candidate and bounded continuation machinery for both active page scopes; add Workshop upstream reserved-start date filtering and local stale-candidate capture. Preserve Dashboard selection/recovery/feedback and individual task refresh.
- CAP-1 transition/retirement: close pre-update unfinished runs rather than translate their progress; preserve historical evidence. Remove all_reserved start/resume/execution support and keep it out of active recovery/health. Its button was deliberately removed because full sync took too long. New-format recovery and freshness match the requested saved dates.
- CAP-2: replace repeated full-run recounting in the shared accounting path; Dashboard has not implemented this optimization. Preserve historical legacy results during accounting changes.
- CAP-3: establish the bulk detail acceptance gate before adding provider batching to the shared path. Existing Dashboard behavior supplies no new completeness/parity evidence.

## Code entry points

- src/app/workshop/_components/WorkshopQueue.tsx: seven-day control, recovery wiring and feedback.
- src/app/dashboard/_components/DashboardSync.tsx: selected-date start/resume chain and feedback.
- src/lib/workshop/actions/sync-actions.ts: action validation, selected-date recovery and individual task action.
- src/lib/workshop/application/manual-sync.ts: old reserved-list loop, selected-period chunks and task refresh.
- src/lib/booqable/fetch-source-snapshot.ts and src/lib/workshop/application/reconcile-order.ts: list/detail transport and shared leased fetch/parse/atomic apply.
- src/lib/workshop/domain/commands.ts and src/lib/workshop/data/sync-health.ts: active scope allowlist, legacy cursors and historical scope parsing.
- supabase/migrations/20260923150000_dashboard_selected_period_sync.sql: historical scope CHECK, selected-period state/candidates/checkpoints/work, result wrapper and Workshop health view.
- supabase/migrations/20260826120000_workshop_sync_retry_counters.sql: shared result upsert/recount.
- supabase/migrations/20260822120000_workshop_sync.sql: historical schema, start/resume functions, run leases, result/finalization RPCs and mixed Workshop health cache.
- Migrations 20260821160000_workshop_source_apply.sql and 20260917124408_workshop_booqable_order_status_sync.sql: atomic apply and lifecycle guards.

## Evidence limits

This baseline is source/SQL inspection, not a live sync or benchmark. Dashboard Story 1.4 records local mocked continuation and database tests but leaves actual provider pagination, live reconciliation, long-run throughput and deployment unverified. Those recorded tests are not newly executed evidence. The research's 20-request experiment remains the bulk-fetch evidence summarized in verification.md.
