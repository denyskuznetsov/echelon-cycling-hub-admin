# Shared sync contract

Both pages use shared discovery/run/recovery infrastructure built from the existing Dashboard path and the existing per-order reconciler. Scope-specific eligibility and UI entry points remain explicit.

## Candidate selection

| Active page-level scope | Eligibility |
|---|---|
| Workshop Next 7 Days (next_7_days) | Reserved orders with scheduled start on today through six days later in Europe/Madrid. |
| Dashboard selected period (selected_period) | Reserved/started/stopped orders whose scheduled start OR scheduled return is in the selected Madrid period. Next Month means the next complete calendar month. |

Workshop sends reserved-status and scheduled-start bounds upstream instead of scanning all reserved pages and recording unrelated rows as skipped. Reuse the existing list transport and date-filtered discovery support. Dashboard already performs two date-filtered passes, for starts and returns, and checks status in the application; preserve that behavior and union the IDs.

Use inclusive start and exclusive end instants calculated from Madrid local dates; handle DST. Freeze Workshop's today-to-seven-days window at run start so a retry across midnight uses the same dates. Dashboard membership is based on starts OR returns, not rental overlap. New/draft/cancelled/archived orders are excluded from Dashboard membership, while locally eligible stale candidates still get reconciled to discover changed source state.

Union upstream discoveries with local IDs selected in PostgreSQL using each requested scope. An order that appears tomorrow locally but is moved next month upstream must be checked and removed from tomorrow's local membership. Preserve tasks/history according to existing reconciliation rules. Deduplicate by Booqable ID; do not repeat recorded successes within a run, and keep failed or uncertain work retryable for active scopes.

Enumeration must prove completion using verified provider behavior. Missing top-level next links alone do not suffice: the research found subsequent list pages without them. The current parser also continues on a full page; verify actual pagination/completion behavior rather than treating that heuristic, stable ordering or deduplication as proof against records moving between pages. Document coverage limits rather than promising a globally atomic provider snapshot.

## Shared run management and recovery

Generalize the existing saved bounds/policy, discovery phases/pages, candidate storage and pending-work continuation for both active scopes. Each action performs bounded work and saves progress. The existing ten-order chunk is a reuse baseline, not evidence of a safe provider batch size or a time limit.

For runs created by the new implementation, preserve run identity, results and frozen dates across continuation actions. A new Workshop Sync click targets today through six days later in Madrid: resume a compatible unfinished run for those exact dates, or start a fresh run. Dashboard retains recovery for the exact selected period. Validate scope, dates, policy and authorization server-side; a client cursor is not authorization.

A run already processing keeps its saved dates even across midnight. Its completion records success for those dates only. An older interval or a historical run with unknown bounds cannot assert coverage of today's entire seven-day window. A new click uses the current dates; existing lease/busy handling still prevents competing work. This is ordinary date handling, with no automatic midnight restart or additional UI required.

When an unfinished run from the previous implementation is encountered, close it as unsuccessful with a recorded reason, preserve its history and tell staff to start a fresh sync. Do not reconstruct its progress, infer its original date window, copy its results into a new run or transfer its old page number into filtered discovery. Preserve the old scope, run ID, counts, per-order results, prior errors and inert cursor evidence. Repeated closure is safe and does not create duplicate history. Completed historical runs retain their outcome.

Use existing lease/busy checks before closing an interrupted old run: if work is still active, let it finish or its lease expire through normal handling. Do not interrupt healthy work or clear unrelated locks. Closed runs cannot resume or accept delayed result/finish writes. A later click on an active scope starts a new run with its own dates, candidates and counters. An old all_reserved request still fails explicitly and never starts a substitute run. No special migration to reconstruct progress or worker-draining subsystem is required.

Both existing page controls drive the shared flow with clear pending/completion/failure feedback. Continuation remains client-driven: navigation can stop later chunks, and new-format saved runs remain recoverable for the same requested interval. An unfinished cursor, failure or unknown coverage cannot advance successful freshness. Workshop and Dashboard success evidence stays separate.

## Retire all_reserved execution and preserve history

Removing the button did not remove executable support. Remove all_reserved from active command validation, dispatch and eligibility paths. Reject attempts to start, resume or execute it through server actions, cursor-to-execution paths, workers, and public/private database start/resume entry points before provider work. Validate the persisted run scope as well as supplied arguments so a forged next_7_days scope cannot revive an all_reserved run. Direct RPC calls and old clients must receive an explicit retired-scope error. This error must not start a substitute run.

Separate historical scope representation from active command allowlists. Keep all_reserved valid in historical storage and read models; do not tighten the existing scope CHECK in a way that rejects preserved rows. Preserve run IDs, original scope, counters, per-order results, prior errors, timestamps and cursor evidence. Historical readers must not reuse an active-only validator that silently drops the old scope. Completed succeeded runs retain their recorded outcome.

Retirement is idempotent and terminal for execution: mark in_progress all_reserved runs failed using the existing non-success state, record a retirement reason/time, and supply a completion time if missing. Already failed runs remain failed and cannot resume, including failed runs with saved cursors or missing completion times. Retain old cursors as inert historical evidence and retain prior failure details alongside retirement information; the storage mechanism is an implementation choice. Do not use the ordinary finish-with-null-cursor path to retire a run, because it can mark a zero-failure run succeeded and advance freshness. Do not undo source/task changes committed before retirement.

Use the close-and-restart rule above for unfinished legacy runs. Keep all_reserved out of active recovery and pending/busy selection. Workshop freshness must come from successful next_7_days runs with the relevant saved interval; the mixed legacy health timestamp alone is insufficient evidence. Preserve historical successes without claiming unknown or older bounds cover the current window. Dashboard freshness remains selected-period scoped.

## Individual task refresh

Preserve syncOrderFromBooqable/syncTaskOrderFromBooqable: staff authorization, environment checks, task-to-order lookup, per-order lease, complete snapshot parsing and guarded reconciliation. It remains a single-order operation, independent of either page's date range and the retired full-sync scope. Keep shared per-order reconciliation available to it; retirement must not disable task refresh or unrelated webhook processing.

## Result accounting

Keep one latest result per run/order and existing listed/succeeded/failed/skipped categories for active callers. Failure-to-success replacement subtracts failure and adds success; the inverse and transitions to/from skipped must be exact. Duplicates must not inflate totals. Upstream-excluded remote rows produce no skipped result. Retirement preserves existing legacy counts and results; it does not record fake per-order failures.

Choose batched result upserts plus one recount per checkpoint, or transactionally correct old/new result deltas, during implementation design. Account for both caller wrappers and existing completion queries when measuring work. All aggregation stays in PostgreSQL. Check progress visibility, concurrent recording and safe replay when apply commits but result recording is interrupted. Per-order atomic source apply remains intact; do not combine a month into one transaction or bypass work using an unproven fingerprint shortcut.

## Boundaries

Preserve staff authorization before the existing privileged worker, environment restrictions, run/order lease fences, task ownership and assignment history, complete snapshot validation, source notices and guarded lifecycle transitions. New user-facing paths must not bypass RLS.

Future migrations, including legacy-run retirement, must be idempotent and authored/applied locally; remote rollout follows repository CI policy. This spec update changes no application files, database or provider data.
