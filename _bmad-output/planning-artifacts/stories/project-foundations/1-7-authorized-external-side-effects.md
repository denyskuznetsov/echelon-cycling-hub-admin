---
title: Authorize external side effects
story_id: '1.7'
epic_id: '1'
review_recommendation: API-1
requirements: [FR7]
status: backlog
priority: urgent
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.7: Authorize external side effects

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review API-1](../../reviews/project-foundations-review-2026-09-15.md#api-1--authorize-external-side-effects-before-executing-them)

## User story

As an administrator managing marketing links,
I want external mutations to enforce the same operation permissions as the application,
So that a signed-in user with read-only access cannot create or delete Short.io links.

## Review context and evidence

`/api/links/create` validates a session but has no explicit admin/manager check before Short.io creation. `deleteMarketingLink` uses `withAuth`, reads `short_io_id`, calls Short.io DELETE, and then issues a database deletion without checking an affected row. Partners can SELECT assigned marketing links under RLS; that read permission can reach the external deletion path even though their database DELETE is denied. The external operation is not protected by database RLS.

Entry points:

- `src/app/api/links/create/route.ts`.
- `src/lib/marketing-links-actions.ts`: `deleteMarketingLink`.
- `src/utils/auth/with-auth.ts`, existing `get_user_role` checks in Bike Fit/Workshop actions.
- `supabase/migrations/20260722130326_create_marketing_links_table.sql`: staff management and partner SELECT policies.
- `src/app/hq/utm-builder/_components/UtmBuilderForm.tsx`, `src/app/hq/links/_components/MarketingLinksTable.tsx`.
- [Next.js action authorization guidance](https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization).

## Scope

- Require the current authenticated role to be admin or manager before Short.io creation/deletion or other protected data lookup in these paths.
- Reuse current auth and role primitives, with appropriate JSON HTTP errors for routes and discriminated failures for server actions.
- Verify database mutation outcomes, including zero affected rows, and keep existing deduplication/retry recovery meaningful.
- Add direct-call tests proving denial before external requests. Inspect analogous existing external mutation boundaries for the same pattern and record any distinct follow-up finding without expanding this story into a platform rewrite.

## Acceptance criteria

### AC1 — Denial before external calls

**Given** an unauthenticated, partner, or mechanic caller, **When** they directly invoke Short.io creation or deletion, **Then** no Short.io request is made, no local row changes, and the appropriate login/401/403 or forbidden action result is returned.

### AC2 — Partner read permission is preserved

**Given** a partner can read a marketing link assigned to them, **When** they use that link's identifier to call deletion, **Then** operation authorization denies the call before the vendor request; **And** legitimate read-only access remains unchanged.

### AC3 — Authorized behavior

**Given** an admin or manager and valid inputs, **When** creation or deletion runs, **Then** the existing assignment, deduplication, and successful UI behavior remains available and current role authorization has been checked before the side effect.

### AC4 — Mutation outcomes are real

**Given** a missing, concurrently removed, or RLS-inaccessible row, **When** the database mutation returns no affected row, **Then** the operation does not report a misleading successful mutation; **And** the caller receives the agreed not-found/already-removed/forbidden outcome.

### AC5 — Partial external/database failure

**Given** Short.io succeeds but persistence fails, or the vendor fails before persistence, **When** the result is returned, **Then** it accurately describes the partial/failure state, preserves enough information for the existing safe recovery path, and a retry does not silently create duplicates or claim unverified success.

### AC6 — Permission-check failures fail closed

**Given** the role lookup fails or the session expires, **When** the operation is attempted, **Then** no vendor request executes; **And** actions retain the `withAuth` session redirect while fetch-called routes return structured HTTP errors.

## Implementation notes and constraints

Read `AGENTS.md`. Do not replace `withAuth` or rely on HQ layouts/nav visibility as the security boundary. Use `get_user_role` and trusted profile state; keep user-facing Supabase requests under authenticated RLS. Do not solve the authorization gap using service-role writes. Select mutation results when necessary to distinguish zero rows from success.

Use mocked Short.io responses and isolated database fixtures for verification. No live creation, deletion, email, or link publication is necessary for this fix. Generic timeout/retry infrastructure belongs to Story 1.9; this story must work with existing transport.

## Verification

- Direct API/action calls for anonymous, partner, mechanic, manager, and admin; assert zero vendor calls on every denial.
- Partner-owned link deletion attempt proves SELECT permission cannot authorize a mutation.
- Exercise zero-row mutation, vendor error, DB error after vendor success, duplicate creation, and safe retry.
- Inspect UI handling of auth/forbidden/error/success responses; run focused tests, TypeScript, and lint.

## Decisions at pickup

- Confirm an explicit response for already-removed links versus forbidden/missing rows, preserving intended idempotent behavior.
- Recheck any existing recovery logic before changing external/database operation ordering; there is no atomic transaction spanning Supabase and Short.io.

## Independence and coordination

No hard dependency. Role authorization can use current profile state even before Story 1.4 repairs how roles are initially assigned; both gaps still need separate fixes. Do not wait for Story 1.8 validation/types or Story 1.9 transport infrastructure. Include all authorization regression coverage here.

## Completion record

Implementation has not started in this recording task. Record permission matrix, partial-failure semantics, changed files, direct-call and zero-vendor-call evidence, residual limits, and final status; update the epic index.
