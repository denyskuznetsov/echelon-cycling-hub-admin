---
title: 'Story 1.5: Simplify Dashboard sync feedback and polish the daily briefing'
type: bugfix
created: '2026-09-23'
status: done
baseline_revision: 'f15a10caf2309136c8436069913d041916f7fd90'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/story-1-5-simplify-dashboard-feedback-and-loading.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Dashboard sync exposes technical diagnostics and manual recovery controls, date changes lack reliable full-content loading feedback, and optional notices/readiness duplicate information. Plain delivery addresses lack navigation.

**Approach:** Implement the existing Story 1.5 Subframe handoff with one selected-period Sync action, accessible blocking feedback, historical success time and actionable errors; show the complete briefing skeleton during date navigation and make the specified row/summary corrections.

## Boundaries & Constraints

**Always:** Fulfil all AC1–AC7 in the source story. Preserve SQL-owned workload, URL-owned Madrid periods, current-task denominators, exact saved sync bounds, staff authorization, user-RLS reads, environment gate, durable bounded continuation, leases/fences and truthful completion. Use the existing design's two left Period rows and separate right Sync section, stacking on phone. Keep real errors and distinct lifecycle states visible. Verify locally with fixtures and browser evidence.

**Block If:** Required behavior cannot preserve the existing authorized saved-run contract or needs live tenant access, remote database changes, or an unresolved product decision.

**Never:** Add a sync engine, scheduler, detached work, provider write, schema redesign, guessed success timestamp, live tenant operation or deployment. Never represent partial/failed runs as success or historical success as current-period coverage. Do not expose run IDs, saved-range diagnostics, counters, discovery pages, run selection or Resume controls.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Sync/recovery | Selected dates; latest exact-date run absent, complete or interrupted | Start fresh or safely resume latest exact-date incomplete run; await bounded continuation under one click and one saved scope | Reject duplicate clicks; active lease/auth/provider errors remain visible |
| Terminal failure | Action rejects, ok:false, or ok:true with state:failed | Remove blocker, preserve prior success time, same Sync action retries safely | Show useful persisted/action error with honest fallback |
| History | Old successful Dashboard run followed by failure, period change or unrelated Workshop sync | Show persisted latest successful selected-period finished_at in Europe/Madrid independently of current run | Distinguish no history from failed history read |
| Date change | Preset/custom navigation with delayed workload | Full content skeleton promptly; new header, totals, priorities and lists appear coherently | Invalid-range and workload errors remain explicit; no fake zeros |
| Notices/readiness | Zero optional counts; real missing-address warning with zero affected bikes; all-ready/mixed/zero tasks | Hide zero optional notices/empty priorities; preserve real warning, core totals and distinct statuses; show ready fraction once | Do not blanket-filter warnings by affected_bikes |
| Destination | Plain text, safe Maps URL, whitespace/missing, failed ETA | Nonblank supplied address opens exact-address Google Maps search; safe selected Maps source stays direct | Blank/unsafe destinations do not become links; ETA does not gate navigation |

</intent-contract>

## Code Map

- `src/app/dashboard/_components/DashboardSync.tsx:15` -- replace diagnostics; its run loop already awaits bounded continuation but overlooks terminal state:failed.
- `src/lib/workshop/data/sync-health.ts:101,134` -- selected-period health model/reader; currently enumerates recoverable history. Use bounded DB-filtered latest exact-date run and independent latest succeeded selected-period finished_at read.
- `src/lib/workshop/actions/sync-actions.ts:50,58` -- existing withAuth selected start/resume boundaries; choose exact-date recovery at action time to avoid stale page props.
- `src/lib/workshop/application/manual-sync.ts:598,679,698` and `supabase/migrations/20260923150000_dashboard_selected_period_sync.sql:40,80,229` -- preserve worker and saved-scope/lease/completion contract; ok:true can still mean state:failed.
- `src/app/dashboard/page.tsx:14` -- currently awaits reads before returning any UI. A date-keyed Suspense boundary around complete async content can stream the shared loading fallback.
- `src/app/dashboard/loading.tsx:3`, `_components/DashboardWorkload.tsx:225`, `_components/DashboardWorkload.module.css` -- reuse skeleton, URL helpers, date validation, styles; navigation pending feedback must include the server-rendered header.
- `src/app/dashboard/_components/DashboardWorkload.tsx:46,66,146` -- duplicate ready lifecycle badge, plain address, always-visible optional summary counts.
- `src/app/dashboard/_components/DashboardNotices.tsx:42` -- empty Attention already hides; preserve legitimate missing-address warnings with affected_bikes:0.
- `src/lib/delivery.ts:28` -- reuse safe external URL guard.
- `src/dashboard-ui.test.mts`, `src/dashboard-task-links.test.mts`, `src/workshop-sync.test.mts` -- existing component/action/worker fixtures. Old diagnostic/Resume assertions require replacement.

## Tasks & Acceptance

**Execution:**
- `src/lib/workshop/data/sync-health.ts`, `src/lib/workshop/actions/sync-actions.ts` -- provide bounded authenticated exact-date recovery selection, independent historical Dashboard success and useful terminal failure detail without weakening existing start/resume gates.
- `src/app/dashboard/_components/DashboardSync.tsx` -- implement one Sync action, automatic continuation, synchronous duplicate guard, accessible fullscreen modal/focus containment and return, clear terminal error/unavailable/no-history feedback, persisted historical timestamp.
- `src/app/dashboard/page.tsx`, `src/app/dashboard/loading.tsx`, `src/app/dashboard/_components/DashboardWorkload.tsx`, `src/app/dashboard/_components/DashboardWorkload.module.css` -- implement design control layout and coherent full-content date loading, using keyed Suspense and a whole-content transition wrapper if needed for prompt feedback; preserve invalid dates, keyboard access and reduced motion.
- `src/app/dashboard/_components/DashboardWorkload.tsx`, `src/app/dashboard/_components/DashboardNotices.tsx` -- hide optional zero notices, preserve empty priorities, add safe exact-address links and remove duplicate readiness facts.
- `src/dashboard-ui.test.mts`, `src/dashboard-task-links.test.mts`, `src/workshop-sync.test.mts` (or focused adjacent test files registered in package.json) -- exercise matrix through rendered UI/action/loader boundaries, retaining worker regression fixtures.
- `_bmad-output/implementation-artifacts/spec-1-5-simplify-dashboard-feedback-and-loading.md` -- record implementation, local query/test results and browser evidence separately from unperformed provider/deployment checks.

**Acceptance Criteria:**
- Given authorized staff viewing any valid preset/custom dates, when Sync is activated, then the UI runs exact selected-period discovery/reconciliation through awaited saved-scope continuation and exposes one Sync control without technical diagnostics or manual Resume.
- Given syncing, when staff try pointer/keyboard Dashboard interaction or duplicate starts, then an accessible fullscreen blocker prevents it until completion/failure; afterwards focus returns and clear errors or persisted historical success are visible. Failed/partial/interrupted runs retain the previous success time and retry through Sync.
- Given successful Dashboard history, when the period changes or a Workshop run completes, then the visible Madrid timestamp remains the latest successful Dashboard selected-period finished_at and makes no coverage claim; no-history, health errors and environment unavailability stay truthful.
- Given delayed preset/custom navigation, when the URL changes, then the complete responsive briefing skeleton appears promptly and persists until header, summary, attention and directional lists render together; invalid/error states remain accessible with reduced-motion support.
- Given zero optional notifications or no actual priorities, when the Dashboard renders, then optional zero items and an empty priority section are absent while core workload totals and real errors remain visible.
- Given a nonblank displayed address, when its keyboard or pointer link is activated, then a new tab opens Google Maps for the exact original text with safe attributes and descriptive accessible name; an existing safe selected Maps link is retained and blank destinations never become links.
- Given all-ready, mixed or zero-task rows, when rendered, then each readiness fact appears once with accurate denominator, all distinct positive lifecycle conditions and fulfillment preserved, and zero tasks explicitly identified.

## Spec Change Log

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - none

## Design Notes

The source story records owner review and correction of the existing design; its implementation request authorizes using that handoff. MCP get_page_info successfully fetched all five states on 2026-09-23. Flow: https://app.subframe.com/ee500777c863/flow/e7b8f32d-9d54-47ba-afa5-73fa04b36553/edit . Ready page: https://app.subframe.com/ee500777c863/design/75ec598e-e631-44e7-8e84-d19ee4115b03/edit . Syncing/error/loading/no-issues page IDs are recorded in the source story. Existing components are available locally; do not resync generated components unnecessarily. Project design documentation is empty.

The ready design has Period presets above custom dates in one expanding left section; Sync/last-success occupy a bordered right section. Mobile stacks these. The syncing design uses a viewport scrim and centered panel headed “Syncing Booqable orders…” with a loader and “Please wait while the selected dates are refreshed.” Implement actual accessibility and behavior around that static design. The rendered screenshot MCP call failed with a transport error; code retrieval succeeded. Browser implementation verification remains required.

Select latest matching run in PostgreSQL before choosing recovery: a newer completed same-date run supersedes older incomplete attempts. Never resume an unrelated saved interval or automatically fall back to start after arbitrary resume failures. Treat state:failed as failure even when result.ok is true.

## Verification

**Commands:**
- `npm run test:dashboard` and `npm run test:workshop-sync` -- focused rendered UI, period, loader/action and existing saved-scope worker fixtures pass.
- `npx tsc --noEmit`, focused ESLint and `git diff --check` -- no introduced type/lint/whitespace errors.
- Verify bounded health selection against the local database using authenticated fixture queries; schema changes are not expected.

**Browser checks:**
- Use local fixtures or request interception, never live sync. Verify multiple continuation steps, terminal failure/interruption/retry, prior timestamp retention, blocker/focus/duplicate guard and unavailable state.
- Deliberately delay the workload read; exercise preset/custom dates, invalid range and history navigation. Inspect full skeleton and coherent success/error replacement at tablet and phone widths, keyboard navigation, wrapping/zoom and reduced motion.


## Implementation record — 2026-09-23

- Replaced Dashboard run diagnostics and Resume controls with one Sync action. At action time, the authenticated client selects the newest exact-date run in PostgreSQL (bounded to one row); completed newer runs supersede older failed attempts. Incomplete/failed exact-date runs use the existing resume boundary and saved scope. There is no fallback start after a resume error.
- Kept the existing worker, leases, fences, authorization, environment gates and schema unchanged. Terminal `ok: true, state: failed` results now become useful action errors using the saved run's `last_error`, with an honest fallback if the detail is missing. The client also defensively treats that state as failure.
- Added a separate bounded history read for the latest `selected_period`, policy-v1, succeeded `finished_at`, independent of the viewed dates and current run. The UI labels this as historical Dashboard success in Europe/Madrid and distinguishes absent history from failed history reads.
- Implemented the existing Subframe handoff using local Button/Dialog/Loader components. A modal scrim blocks pointer/keyboard interaction, contains focus, prevents Escape dismissal and returns focus to Sync. A synchronous ref guard prevents duplicate starts; each continuation remains awaited.
- Added a date-keyed server Suspense boundary around the complete async briefing plus a client transition wrapper hiding the entire old briefing, including its server-rendered header. Both pending surfaces share the responsive, reduced-motion-aware route skeleton.
- Applied the two-row Period section and separate right Sync section, stacking on phones. Removed optional zero-count notices and duplicate ready lifecycle badges, retained core totals/distinct lifecycle states/zero-task messages and real missing-address warnings with zero affected bikes. Nonblank addresses now link to a Google Maps exact-text search; safe selected Maps links remain direct.

### Automated verification

- `npm run test:dashboard`: **34/34 passed**, including new rendered UI, action-time recovery, bounded loader/history, terminal error, duplicate-click, address and readiness fixtures.
- `npm run test:workshop-sync`: **30/30 passed**, retaining the existing fixed-scope, environment, continuation, failure and lease worker fixtures.
- `npx tsc --noEmit`: passed.
- Focused ESLint on Dashboard production files and changed sync reader/actions: passed. Repository ESLint configuration ignores `.test.mts` files; those were executed by the test runner.
- `git diff --check`: passed.

### Fixture browser evidence

Executed `node .next/story-1-5-browser.mjs` using bundled Playwright and isolated Chrome against fixture-only localhost:3015. The harness bundled the actual Dashboard React/Subframe components with mocked sync/ETA/router boundaries. It never used a live provider. All task artifacts stayed inside the repository.

Passed: four awaited sync steps; `state: failed`, `ok: false`, and rejected-action failures; same-button retry; prior timestamp retention; disabled duplicate control; Tab focus containment, Escape prevention, focus return; delayed preset/custom navigation hiding the old server-header surface; invalid-range display; reduced-motion skeleton; exact-address link and keyboard focus; environment-unavailable state; no horizontal overflow at 390px. No browser runtime errors were observed. The fixture delays its router boundary; actual Next.js server streaming/history verification is separate from this fixture evidence.

Inspected fixture screenshots (local ignored artifacts): `.next/story-1-5-fixtures/syncing-tablet.png`, `loading-tablet.png`, `ready-phone.png`, and `loading-phone.png`. These verify geometry and interaction states at 1024px and 390px; typography in the standalone fixture does not include Next's loaded font variables. The fixture server and isolated browser were closed after the run.

### Actual-route browser evidence

The coordinating task used the authenticated local Next.js page (no Sync action): choosing Next 7 days briefly showed “Loading daily briefing”, then committed the full page with the 23–29 September label and its matching 7 orders / 13 bikes workload. The shared tab was restored to Today. This verifies the real route/navigation boundary separately from fixture action behavior.

### Authenticated local database evidence

The coordinating task verified the read paths using Docker's local PostgreSQL client inside a `BEGIN`/`ROLLBACK` transaction, `SET LOCAL ROLE authenticated`, and Supabase JWT claim settings for a seeded admin fixture. There was one exact-date `selected_period` run for 2026-09-23, and three historical `selected_period`, policy-v1 succeeded runs with non-null `finished_at`. This verifies authenticated/RLS access to the local data used by the new bounded queries; mocked loader/action tests separately prove latest-run selection, date isolation, completion precedence and independent history selection. The transaction was rolled back. The initial CLI multi-command attempt was superseded by this successful psql check.

### Scope of evidence

No live Booqable sync, provider write, remote database change or deployment was performed. No schema migration was needed. Actual-route browser checks and authenticated local-database query evidence are recorded above separately from the fixture browser evidence. The implementation passed review. Live-provider, hardware, deployed-environment and production evidence is outside this story verification.

## Auto Run Result

- **Summary:** Completed Story 1.5: simplified Dashboard sync feedback, added accessible blocking progress, surfaced independent historical success and useful failure feedback, added coherent date-navigation loading, and corrected notices, readiness, and destination links.
- **Files changed:**
  - `package.json` — registers focused Dashboard sync tests.
  - `src/app/dashboard/_components/DashboardNotices.tsx` — suppresses optional empty notice rows while retaining real warnings.
  - `src/app/dashboard/_components/DashboardSync.tsx` — provides one sync action, accessible blocking feedback, history and errors.
  - `src/app/dashboard/_components/DashboardWorkload.module.css` — styles sync layout, navigation pending state and responsive skeleton behavior.
  - `src/app/dashboard/_components/DashboardWorkload.tsx` — fixes readiness duplication, notice summaries and address links.
  - `src/app/dashboard/_components/DashboardNavigation.tsx` — keeps the full briefing transition coherent during URL navigation.
  - `src/app/dashboard/loading.tsx` — supplies the responsive full-briefing skeleton.
  - `src/app/dashboard/page.tsx` — keys complete async page content by selected dates.
  - `src/dashboard-sync.test.mts` — covers bounded health reads and sync action outcomes.
  - `src/dashboard-task-links.test.mts` — verifies exact-address external link behavior.
  - `src/dashboard-ui.test.mts` — verifies revised rendered Dashboard states and controls.
  - `src/lib/workshop/actions/sync-actions.ts` — selects exact-date recovery at action time and reports durable terminal failures.
  - `src/lib/workshop/data/sync-health.ts` — adds bounded recovery and independent successful-history reads.
  - `_bmad-output/implementation-artifacts/spec-1-5-simplify-dashboard-feedback-and-loading.md` — records implementation, verification and review.
- **Review findings:** 0 patches applied; 0 items deferred; 0 items rejected. All four review passes returned no actionable findings.
- **Follow-up review recommendation:** false. Patched findings: 0 high, 0 medium, 0 low; score 0.
- **Verification:** `npm run test:dashboard` passed (34/34); `npm run test:workshop-sync` passed (30/30); `npx tsc --noEmit` passed; focused ESLint passed; `git diff --check` passed. Fixture browser checks passed at tablet and phone sizes, real authenticated route navigation was verified without starting sync, and read-only local authenticated database queries completed within rollback. No live provider operation or remote database change occurred.
- **Residual risks:** Live-provider, hardware, deployed-environment and production behavior were not exercised. The actual-route browser check covered date navigation; sync interactions were exercised against local fixture boundaries.
