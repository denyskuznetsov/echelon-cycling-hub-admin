# Deferred Work

- source_spec: none
  summary: Implement the mechanics workshop substrate and CAP-1 through CAP-10 (task reconciliation, queues, checklists, M1/M2, add-ons, pickup/return, storage, invalidation, and sync) after the Next.js 16 upgrade gate is green.
  evidence: The canonical workshop spec is ten independently testable capabilities plus architecture AD-1–AD-13; this build run is limited to AD-12 / Build Readiness item 1 (Next.js 16.3.1 upgrade of the existing app).

- source_spec: `_bmad-output/implementation-artifacts/spec-upgrade-nextjs-16.md`
  summary: Clear the 21 `react-hooks` errors (and 22 warnings) that `eslint-config-next@16.3.1` now reports via eslint-plugin-react-hooks v7.
  evidence: `npm run lint` exits non-zero on pre-existing setState-in-effect / refs / static-components patterns; the upgrade AC allows listing them rather than rewriting those components in this run.

- source_spec: `_bmad-output/implementation-artifacts/spec-upgrade-nextjs-16.md`
  summary: Smoke-test unauthenticated HTML → `/login?next=...`, API/`next-action` skip, and cookie refresh through live `proxy` after the middleware rename.
  evidence: Gate tests regex-scan `proxy.ts` / `updateSession` source and do not issue an HTTP request; Ask First called for a halt if auth regresses.

- source_spec: `_bmad-output/implementation-artifacts/spec-upgrade-nextjs-16.md`
  summary: Guard `requireAnonymous` `fallbackNext` so it only accepts same-origin relative paths.
  evidence: `fallbackNext.trim()` is used as a redirect target with no `startsWith("/")` check; that open-redirect shape predates the upgrade.

- source_spec: none
  summary: Replace the mock Kanban with workshop work queues and a dedicated `/workshop/[taskId]` page for the guarded lifecycle (M1, M2, add-ons, pickup/return, storage).
  evidence: Split from the mechanics daily-work intent so this run can land schema, RLS, commands, and seeds without UI cut-over.

- source_spec: none
  summary: Run the controlled Booqable tenant spike and amend AD-2 / AD-10 with the verified include path, workshop-tag field, terminal statuses, debounce, webhook behavior, and sync numbers.
  evidence: Split from the mechanics daily-work intent because live-tenant measurement is research, not foundation schema work, and apply/sync must not invent those values.

## Deferred from: code review of spec-booqable-source-apply.md (2026-08-22)

- Live `SET ROLE authenticated` call of apply/acquire still not executed; local Postgres closed the connection on that path, so staff-JWT denial remains `has_function_privilege` plus an empty `bq-authz` count.
- Parser envelope is not round-tripped into `booqable_apply_source_snapshot_v1` in CI; `verify:workshop` / adapter→apply remains an AD-13 seam (prior review also rejected adding CI wiring in this slice).
- Bike `identifier` / title changes do not update workshop display fields when source and add-on fingerprints are otherwise unchanged; accepted for now (rename in Booqable need not refresh the task row).

## Deferred from: code review of spec-workshop-ui.md (2026-08-24)

- README still lists `@hello-pangea/dnd` for the mechanic kanban board after the package and Kanban files were removed; README was outside this story’s file list.
- Drawer wiring tests still grep layout/task source for `OrderDetailsDrawerHost` / `useOpenOrderDetails` and never render the host, so a missing host in the tree would not fail `test:workshop-ui`.
- Repo-wide `npm run lint` still fails on pre-existing bike-fits/wiki `react-hooks` findings from the Next.js 16 upgrade; workshop eslint is clean.
- Workshop layout `redirect("/login")` has no `?next=`, matching the other role layouts; session expiry on a task page does not resume at that task.

- source_spec: `_bmad-output/implementation-artifacts/handover-workshop-sync-auto-page.md`
  summary: One **Sync next 7 days** click should walk Booqable reserved pages until the 7-day scan is done; remove **Resume sync**.
  evidence: Staff dropped **Sync all reserved**. Resume only exists because list sync stops after 50 reserved rows (shop-wide, not 7-day). User chose auto-paging over keeping Resume.

- source_spec: `_bmad-output/implementation-artifacts/spec-workshop-sync-auto-page.md`
  summary: A killed or timed-out next-7-days walk can leave the run `in_progress` with no cursor, which keeps the overlay and blocks Sync.
  evidence: Review of the auto-page walk; `booqable_finish_sync_run` never runs if the server action dies, and the spec forbids inventing `maxDuration` or a hidden continue.

- source_spec: `/Users/denyskuznetsov/Documents/echelon-cycling-hub-admin/echelon-cycling-hub-admin/_bmad-output/implementation-artifacts/spec-pending-page-navbar.md`
  summary: Approved users who bookmark or land on `/pending` via `?next=` stay on the waiting-room copy instead of being sent to their role home.
  evidence: Pre-existing — the page never redirected users who already have a role; this run only added chrome.

- source_spec: `/Users/denyskuznetsov/Documents/echelon-cycling-hub-admin/echelon-cycling-hub-admin/_bmad-output/implementation-artifacts/spec-pending-page-navbar.md`
  summary: `/pending` always says the account is awaiting approval, including when the profile query failed rather than the role being missing.
  evidence: Pre-existing copy; every role layout already dumps both “no role” and profile-load failure onto this page.

- source_spec: `/Users/denyskuznetsov/Documents/echelon-cycling-hub-admin/echelon-cycling-hub-admin/_bmad-output/implementation-artifacts/spec-pending-page-navbar.md`
  summary: The topbar logo on `/pending` goes to `/`, which immediately sends a no-role user back to `/pending`.
  evidence: `AppTopbar` uses `/` for non-staff; fixing it needs a pending-aware logo href on shared chrome.

- source_spec: `/Users/denyskuznetsov/Documents/echelon-cycling-hub-admin/echelon-cycling-hub-admin/_bmad-output/implementation-artifacts/spec-pending-page-navbar.md`
  summary: `test:pending-layout` is not part of an aggregate `test` script or CI job.
  evidence: Pre-existing repo pattern — each `node --test` file has its own npm script and is not wired into GitHub Actions.

- source_spec: `_bmad-output/implementation-artifacts/spec-booqable-customer-created-sync.md`
  summary: Staff `/customers` table plus Customers nav href showing name and three destination statuses.
  evidence: Split from customer landing so this run can ship fail-closed event parse and destination writes without the morning-check UI.

- source_spec: `_bmad-output/implementation-artifacts/spec-customers-landing-status.md`
  summary: Staff customer edit UI so missing passport fields (address, email) can be filled before a destination upload.
  evidence: Bike-fit rows have no address and often no email; dests (especially Mailchimp) reject incomplete data. This run lands what exists and shows red; editing is a later stage.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-bike-tasks-duplicated-info.md`
  summary: After scoping the task list, a change on another bike can still trip M2 `ADD_ONS_CHANGED` because the fingerprint stays whole-order.
  evidence: Spec Ask First forbids changing `addon_fingerprint` / M2 snapshot in this run; the display is per-bike and the confirm token is not.

## Deferred from: code review of spec-fix-bike-tasks-stock-line.md (2026-09-03)

- Folded `CREATE OR REPLACE` copies of `booqable_create_instance_task_inner`, `booqable_sync_retained_task`, and `workshop_task_detail` in `20260902140000_workshop_task_addons_scope.sql` can overwrite later staging/Haribo bodies of those functions. Spec parked merge/rebase onto staging for a later run.
- Drawer stock tags are proven only in `attachStockDisplayIdsToItems` plus a source grep. `loadOrderDetails` and `ItemRow` never run in tests; a qty-2 line can load without badges and CI stays green. Matches the existing workshop-ui grep style.

- source_spec: none
  summary: Switch `/customers` from the landed-only activity list to a full customer directory (Booqable people plus local bike-fit rows, left-join dest badges).
  evidence: Split from the historical dest backfill so this run can land every Booqable person and write production `customer_sync` without rewriting the page. Locked decision: activity list was a temporary shortcut; the directory is the intended product. Local `customers` rows stay; they merge with Booqable identity, they are not deleted.

- source_spec: none
  summary: Persist Mailchimp `review-request` tag state on `customer_sync` and show Yes / Error / dash on the customers table.
  evidence: Split from the historical dest backfill. Locked meaning: Yes = successful tag write; Error = tag write failed; dash = local-only customer that was never uploaded (not “never attempted” in the generic sense). No event-log table — latest snapshot only, same as dest badges.

- source_spec: none
  summary: After dest landing, backfill the Mailchimp `review-request` tag for customers whose Booqable order has already stopped.
  evidence: Split from the historical dest backfill. Order is land first, then tag (tagger does not create a member). No review email campaign exists yet, so journey-fire risk is accepted. Zapier is already off.

- source_spec: `_bmad-output/implementation-artifacts/spec-dashboard-visual-hierarchy.md`
  summary: Correct existing dashboard mobile tab accessibility references and keyboard entry behavior.
  evidence: Desktop and mobile DirectionList instances reuse heading IDs; inactive tab aria-controls references an unmounted panel and both tabs remain in the Tab sequence. These patterns predate this visual refinement.
