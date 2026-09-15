---
title: Project foundations review
type: review-snapshot
status: recorded
review_date: '2026-09-15'
recorded_date: '2026-09-15'
review_baseline_commit: '10fbda3410d5b2dff2c2e1af8ffaac3628f6707c'
recording_baseline_commit: '8d8118cf9d730c41dd5bb1e52a43c7c315fcd476'
source: 'Review in this Codex conversation, accepted by the user as the source for one epic and nine stories.'
---

# Project foundations review — 2026-09-15

## Purpose and scope

Preserve the findings that motivated the [Project Foundations epic](../epics.md). The project is growing quickly by reusing existing fundamentals; the objective is coherent, enforceable patterns for future features.

The review scanned application code, integrations, all 28 migrations then present, tests, and repository CI configuration. Server loaders, URL state, SQL views/RPCs, RLS, and `withAuth` are the existing foundations to retain. Their enforcement varies across features. The role-assignment and external-side-effect authorization findings have first priority.

This is a dated source review, not a claim about future branch state. Shared-search work changed the checkout during the review. At recording time, HEAD is `8d8118c` (`fix: use explicit shared list search`), with additional user-owned changes present. Revalidate every finding before implementation; do not discard it solely because line numbers moved.

## Review findings

### FE-1 — Standardize the complete list interaction pattern

Shared search was already being implemented. Extend consistency to URL construction, pagination/filter resets, and table-local loading feedback. Orders directly pushes navigation while Workshop manages a pending transition. One reusable pattern should prevent each new listing from reimplementing these details.

Evidence: `src/app/orders/_components/AllOrdersTable.tsx` (`buildHref`, direct `router.push`); `src/app/workshop/_components/WorkshopQueue.tsx` (`pushQueue`, navigation pending); `_bmad-output/implementation-artifacts/spec-shared-submit-search.md`.

Recording update: reuse the committed `src/components/SearchField.tsx` and `search-field-state.ts`; the story must assess the remaining list behavior instead of rebuilding shared search. The existing search spec explicitly excludes partner listings and entity pickers from its scope.

### FE-2 — Create a reusable, reliable save lifecycle

Bike Fit and Wiki each implement autosave. Their cancellation flags suppress outdated UI responses but do not cancel database writes or detect concurrent edits. Introduce serialized saves, explicit save/error states, and record-version checks. Workshop already provides a stronger model worth extracting into reusable logic.

Evidence: `src/app/bike-fits/_components/BikeFitWizard.tsx` (autosave effect); `src/app/wiki/_components/WikiEditor.tsx` (autosave effect); their corresponding server actions; `src/app/workshop/_components/WorkshopTask.tsx` (serialized item commands and expected versions).

Limit: code inspection identifies missing write-conflict protection; the review did not reproduce an out-of-order write in a browser. Verify delayed requests and multiple editing sessions in implementation tests.

### FE-3 — Make frontend quality checks a dependable gate

The final review lint run reported 17 errors and 22 warnings. Several UI/auth tests inspect source strings rather than exercising rendered behavior. Resolve the lint baseline and add a small browser suite for search/history, autosave, and role navigation, then require checks before merge.

Evidence: `eslint.config.mjs`, `package.json`, `src/upgrade-gate.test.mts`, `src/workshop-ui.test.mts`, and `.github/workflows/`.

### DB-1 — Make role assignment trusted

The signup trigger copies `raw_user_meta_data.role` into `profiles.role`, including privileged roles. Replace that with trusted provisioning and a safe default, and test that signup metadata cannot grant admin access. Production exposure depends on signup configuration, which was not inspected.

Evidence: `supabase/migrations/20260608102505_remote_schema.sql`, function `public.handle_new_user`, especially the role expression at review line 142. The repository's local Auth configuration enables signup. [Supabase documents that user metadata is user-editable and unsuitable for authorization](https://supabase.com/docs/guides/auth/users).

### DB-2 — Make database recreation and migration validation mandatory

The deployment workflows push migrations without first rebuilding a disposable database or running existing SQL tests. Required `bike-fit-images` bucket setup lives in `supabase/seed.sql`, alongside exported auth/application records. Move required setup into migrations, use synthetic fixtures, and gate deployment on fresh migration replay, SQL tests, and reapplication checks for new migrations.

Evidence: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`, `supabase/config.toml`, `supabase/seed.sql`, and the six suites under `supabase/tests/database/`. The bucket is referenced by application storage code and policies but created in seed data.

### DB-3 — Give reporting one SQL source of truth

Totals and commissions are calculated separately in the frontend and CSV route. The export fetches orders without pagination and can hit the API row limit. Define SQL contracts for totals, commission units, rounding, and eligible orders. Dashboard and export should consume the same contract, with paginated export retrieval.

Evidence: `src/app/partner/_components/OverviewStats.tsx`, `src/app/api/partners/download-report/route.ts`, `src/app/partner/_lib/loadPartnerOverview.ts`, and `public.get_partner_daily_stats` in the baseline migration. Local `supabase/config.toml` sets `max_rows = 1000`; the deployed cap was not verified. The current commission normalizer accepts two unit conventions, and the SQL cancellation exclusion is commented out. These are business decisions to resolve, not assumptions to silently change.

### API-1 — Authorize external side effects before executing them

Short.io creation checks authentication only. Deletion uses `withAuth`, then deletes externally before verifying that the database deletion actually affected a row. Under current policies a partner can read an assigned link and reach that external deletion path. Require admin/manager authorization before the external request and verify affected rows.

Evidence: `src/app/api/links/create/route.ts`, `src/lib/marketing-links-actions.ts`, and `supabase/migrations/20260722130326_create_marketing_links_table.sql`. Partner SELECT permission is not permission to perform a Short.io mutation. [Next.js requires authorization inside the action itself](https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization).

### API-2 — Make data boundaries typed and validated

Supabase clients lack generated database types, and loaders frequently cast results into handwritten types. TypeScript passing therefore does not establish that queries match the schema. Generate types from local migrations, use typed clients, and consistently validate incoming payloads with Zod.

Evidence: `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/lib/customers.ts`, `src/lib/orders.ts`, and JSON handling in `src/app/api/links/create/route.ts`. [Supabase supports schema-derived TypeScript types from the local database](https://supabase.com/docs/guides/api/rest/generating-types).

### API-3 — Standardize external-request failure handling

Booqable has retries but no explicit request deadline. Other integrations have separate request helpers without consistent timeout/retry handling. Customer synchronization waits for every destination before saving results. Introduce request deadlines, bounded retries for safe operations, and independently persisted destination outcomes.

Evidence: `src/lib/booqable/fetch-source-snapshot.ts`, `src/lib/customer-landing/{google,holded,mailchimp,land-customer,landing-store}.ts`, `src/lib/posthog/traffic.ts`, and the Short.io request sites. In `land-customer.ts`, `collectLandingStatuses` awaits all writers before `saveStatuses` runs. Existing Booqable leases, complete-snapshot application, environment guards, and synchronous webhook completion must be preserved.

## Verification recorded at review time

- TypeScript: `tsc --noEmit --incremental false` passed.
- Node suite: `node --test src/*.test.mts` passed all 161 tests in the final review run.
- ESLint: 17 errors and 22 warnings in the final review run; counts changed as concurrent search work progressed.
- Database findings came from repository SQL. Live database behavior and browser flows were not tested.
- No project changes were made by the review. These results are historical evidence, not a current acceptance result for any story.

## Translation into later work

Exactly one epic and nine stories preserve the one-to-one mapping FE-1–FE-3, DB-1–DB-3, API-1–API-3. Recording a story authorizes backlog preparation, not immediate implementation, deployment, remote DDL, or external vendor writes. Each standalone story contains scope, evidence, acceptance criteria, local verification, and unresolved decisions for its future session.
