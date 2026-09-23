---
title: 'Story 1.3: See approximate driving time for deliveries'
type: feature
created: '2026-09-23'
status: done
baseline_revision: '07c4d0d5cc84b514d51d2964f70be07765af6e16'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Staff can see delivery destinations on the Dashboard but cannot see an approximate drive duration from the shop. Routing may be unavailable and must never prevent the rental workload from loading.

**Approach:** Add a separate staff-authorized estimate action backed by Google Routes v2 and independent per-row UI state. The server rereads each local order's current delivery fields and routes only supported destinations; the client accepts results only while they match the displayed source inputs and selected period.

## Boundaries & Constraints

**Always:** Preserve the existing SQL/display destination precedence and all core workload behavior. Authorize staff before any provider work, use the caller's RLS client for order reads, and send only shop origin, resolved destination and routing parameters to Google. Use DRIVE/TRAFFIC_UNAWARE and a duration-only field mask. Bound batch size, provider concurrency, timeout and response bytes; deduplicate identical inputs within one load. Display supplied but unsupported destinations with “Drive time unavailable,” and successful duration with “Approx.” and visible Google Maps attribution. Record operational readiness separately from fixture evidence.

**Block If:** The current order source cannot be reread safely under staff RLS, or an input requires guessing which destination a Maps link represents. Unknown or ambiguous inputs receive unavailable state. Live credentials, provider calls, billing settings or deployment require their own authorization.

**Never:** Put credentials in the browser, accept arbitrary URLs as routing proxies, use viewport coordinates, scrape Maps HTML, expand short links without bounded redirect/host/private-network controls, infer a destination from customer/billing fields, alter order/task/source data, persist ETA responses, poll, retry, add a date-range cap, or make drawer navigation fetch estimates.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Routable delivery | Staff order with current plain address or supported explicit Maps destination | Approximate duration, Google Maps attribution beside preserved destination | Invalid provider payload is unavailable |
| Missing or unsupported | No source destination, ambiguous Maps URL or unsupported short link | No request; missing remains missing, supplied input remains visible and unavailable | No false missing-address count |
| Provider failure | Slow, quota, timeout, malformed or unconfigured provider | Workload remains usable; affected rows become unavailable | Sanitized contextual server log; no retry |
| Stale result | Period or displayed provenance/value changes, or server reread differs | Discard result tied to old inputs | Current row retains its independent state |
| Denied caller | Partner, pending or expired session calls estimate action directly | No provider request and no staff order disclosure | Staff-only error or withAuth login redirect |

</intent-contract>

## Code Map

- `src/app/dashboard/page.tsx:15` -- core workload render must not await Routes; the existing period/workload props drive a separate client effect.
- `src/app/dashboard/_components/DashboardWorkload.tsx:55` -- existing destination text/link, outgoing rows, desktop and mobile render; attach one estimate state keyed by displayed order/period/inputs without changing the shared order action.
- `src/app/dashboard/_components/DashboardWorkload.module.css` -- existing responsive row layout; allow estimate and attribution to wrap under zoom.
- `src/lib/dashboard/workload.ts:7` -- validated row IDs, fulfillment, destination provenance/value; no workload RPC change required.
- `src/lib/delivery.ts:11` -- shared trim-and-prefer-address rule; reuse for the fresh order read, then resolve only conservative destination-bearing Maps forms.
- `src/lib/orders/actions/current-task-actions.ts:16` -- `withAuth`, active staff role and caller RLS action pattern. Reuse for a bounded local-ID estimate batch.
- `src/ui/layouts/brand-assets.ts:7` -- seeded BUSINESS_ADDRESS origin; exact physical origin still needs operational verification.
- `supabase/migrations/20260922100000_dashboard_workload.sql:54` -- existing SQL destination precedence; read-only reference for parity.
- `src/dashboard-ui.test.mts` -- existing Dashboard UI test seam; add estimate lifecycle and stale-result coverage with a separate adapter/action test if needed.

## Tasks & Acceptance

**Execution:**
- `src/lib/dashboard/route-destination.ts` -- parse plain addresses and a narrow, fixture-backed set of explicit Google Maps destination forms; reject ambiguous/viewport/unsupported links without navigation or fetch.
- `src/lib/dashboard/google-routes.ts` -- implement server-only Routes v2 DRIVE/TRAFFIC_UNAWARE duration adapter with minimal field mask, bounded timeout/bytes, strict response validation, sanitized logging and no retry.
- `src/lib/dashboard/actions/delivery-estimates.ts` -- implement `withAuth` staff-only bounded ID batch, reread orders through user RLS, reuse destination precedence, deduplicate identical route inputs and return input-bound per-order success/unavailable results.
- `src/app/dashboard/_components/DashboardWorkload.tsx` and `DashboardWorkload.module.css` -- request estimates after workload display, process all eligible outgoing delivery rows in bounded chunks, show independent loading/result/unavailable states and attribution, and discard late/mismatched responses across period/source changes.
- `src/dashboard-routing.test.mts` and `src/dashboard-ui.test.mts` -- cover destination forms, provider success/timeout/quota/malformed payload, authorization/no-request, reread/parity/minimal payload, deduplication, stale A→B, usable workload and drawer-only navigation.
- `_bmad-output/implementation-artifacts/spec-1-3-see-approximate-driving-time-for-deliveries.md` -- record exact fixture versus live/provider/device evidence and any unmet rollout gates.

**Acceptance Criteria:**
- Given a direct estimate request from staff or a nonstaff caller, when authorization runs, then only staff can reread current local delivery inputs and denied callers cause zero provider calls.
- Given a supported current destination, when its independent estimate completes, then the row keeps its destination and shows an approximate duration with Google Maps attribution; the request contains only origin, destination and routing parameters.
- Given missing, unsupported or ambiguous delivery input, when estimates are considered, then no invented route is requested and the original supplied/missing distinction remains visible.
- Given many rows and a slow, failed or unconfigured provider, when the Dashboard renders, then counts and lists stay usable, each row has its own honest state, and execution respects documented request bounds without truncating the selected period.
- Given the displayed period, destination provenance/value or fresh server source changes while an estimate is in flight, when the result arrives, then it is shown only when its exact request inputs still match the current display; opening only the shared drawer causes no refetch.

## Spec Change Log

- 2026-09-23: Implemented a staff-only order reread and a separate Google Routes v2 duration request. The client requests bounded chunks after rendering and retains each result only for the same period and displayed destination kind/value. Accepted Maps URL forms are explicit Google Maps `api=1` directions destinations and search queries with a street number and comma; short links, viewport URLs, and broad queries remain visible but unavailable.
- The server accepts at most 10 distinct local UUIDs per action, routes at most three distinct destinations concurrently, and gives each provider request a 5-second timeout and 8 KiB response limit. Identical destinations are deduplicated within an action, and the client carries verified outcomes across subsequent batches of the same load while the server rereads each order. No route result is persisted.
- Follow-up: ETA status is rendered only for outgoing delivery rows; incoming and pickup rows retain any supplied destination without a perpetual loading label. Added pending-role and expired-session fixtures alongside partner denial.
- Review follow-up: client-known unsupported inputs show unavailable immediately and skip the estimate action; explicit Maps destination coordinates and place IDs become typed Routes waypoints. Text Maps URLs require a numbered street address; placeholder plain addresses remain supplied but unroutable. Shared trim now matches the SQL ASCII `btrim` set, including NBSP remaining supplied. Results bind to origin, destination, DRIVE, and TRAFFIC_UNAWARE; only successful durations are reused across batches.

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 2, medium 7)
- defer: 0
- reject: 5
- addressed_findings:
  - `[medium]` `[patch]` Show unavailable immediately for client-known unsupported destinations and keep supplied text visible.
  - `[high]` `[patch]` Reject ambiguous text Maps queries and accept explicit destination coordinates or place IDs without using viewport coordinates.
  - `[medium]` `[patch]` Reject common placeholder addresses before a provider request.
  - `[medium]` `[patch]` Match the SQL ASCII destination trim rule, including nonbreaking-space behavior.
  - `[medium]` `[patch]` Reuse only successful durations across batches so one failed route does not suppress later work.
  - `[high]` `[patch]` Bind displayed results to shop origin, typed destination and DRIVE/TRAFFIC_UNAWARE inputs as well as period and source provenance.
  - `[medium]` `[patch]` Add a rendered drive-time state test for loading, success and unavailable outcomes.
  - `[medium]` `[patch]` Record the absence of real saved-URL and authenticated RLS integration evidence as rollout limits.
  - `[medium]` `[patch]` Clarify that origin, provider, billing, attribution and device checks remain release gates rather than fixture results.

## Auto Run Result

Story 1.3 adds independently loaded approximate drive times beside supported outgoing delivery destinations. A staff-only action rereads current orders under the caller's Supabase session, resolves the existing destination precedence, and sends only bounded duration requests to Google Routes v2. Unsupported, missing, failed and stale inputs remain distinct from the core workload.

Browser feedback follow-up (2026-09-23): Drive estimates now also appear for incoming delivery orders because staff drive to the destination to collect the bikes. Both directions show the approximate drive **from the shop**; duplicate outgoing/incoming appearances of one order share one request. The plain address shown in the feedback is accepted as a route input, but the local environment has no Routes API key, so live duration remains unavailable. Earlier Story 1.2 notices now align their severity label with the message baseline and distinguish Booqable pickup ahead of preparation from a returned order with no Workshop pickup record.

Files changed: `src/lib/dashboard/route-destination.ts` parses explicit safe destinations; `src/lib/dashboard/google-routes.ts` performs bounded server-only requests; `src/lib/dashboard/actions/delivery-estimates.ts` authorizes, rereads and deduplicates; `src/lib/dashboard/estimate-state.ts` binds results to the current display; `src/lib/delivery.ts` matches SQL trim semantics; `src/app/dashboard/_components/DashboardWorkload.tsx` and its CSS show independent row states and attribution; `src/dashboard-routing.test.mts`, `src/dashboard-ui.test.mts`, `src/delivery.test.mts` and `package.json` register focused fixtures and rendered component checks.

Review: 9 patches applied (high 2, medium 7); 0 deferred; 5 rejected as existing recorded rollout gates, self-limited caller behavior or a bounded serial-work tradeoff. Follow-up review recommended: true; patched medium/low score is 21, and high findings also trigger the recommendation.

Verification: `npm run test:dashboard` passed 21/21, focused routing tests 5/5, `npx tsc --noEmit`, focused ESLint and `git diff --check` passed. No remote database, live provider, deployment or production change was made. Interactive browser/device behavior, real saved destination formats, integrated staff/RLS requests, physical shop origin, restricted credential, billing/quota, attribution and applicable terms/privacy remain unverified release gates.

Browser feedback verification (2026-09-23): `npm run test:dashboard` passed 22/22, `npx tsc --noEmit`, focused ESLint and `git diff --check` passed. The local authenticated browser shows drive-time state for both outgoing and incoming delivery rows, with the revised pickup/return warnings and aligned row labels. It still shows unavailable durations because no local Routes API key is configured; no live provider request was made.

## Verification

**Local fixture evidence (2026-09-23):** `npm run test:dashboard` passed 21 tests, including destination parsing, typed provider payloads, malformed/quota/timeout/oversized/unconfigured responses, partner/pending/expired-session denial, fresh-source deduplication, no reuse of failed durations, routing-input mismatch, SQL trim parity, and rendered loading/duration/unavailable component states. `npx tsc --noEmit`, focused source ESLint, and `git diff --check` passed. These are fixtures and server-rendered component checks; no interactive staff browser, phone, tablet, or zoom check was performed.

**Operational readiness:** `GOOGLE_MAPS_ROUTES_API_KEY` was not present in the inspected local environment files. No live Google Routes request, real saved-URL audit, integrated authenticated RLS request, credential/billing/quota review, Google attribution or EEA terms/privacy review, physical shop origin confirmation, deployment, or actual device check was performed. Routing will display “Drive time unavailable” until a server-side key is configured. The existing `BUSINESS_ADDRESS` supplies the shop origin and still requires physical confirmation.


**Commands:**
- `npm run test:dashboard` -- expected: workload and routing UI tests pass.
- `node --test src/dashboard-routing.test.mts` -- expected: adapter, parsing and authorization fixtures pass.
- `npx tsc --noEmit` -- expected: no TypeScript errors.
- `npx eslint <changed source paths>` -- expected: no new lint errors.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks (if no CLI):**
- Record whether actual staff browser/device, provider credential, billing, quota, attribution and terms/privacy checks were performed; keep any absent rollout evidence explicit.
