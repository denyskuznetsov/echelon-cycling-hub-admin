---
title: Typed and validated data boundaries
story_id: '1.8'
epic_id: '1'
review_recommendation: API-2
requirements: [FR8]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.8: Typed and validated data boundaries

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review API-2](../../reviews/project-foundations-review-2026-09-15.md#api-2--make-data-boundaries-typed-and-validated)

## User story

As a developer reusing database loaders and API actions,
I want schema-derived database types and validated boundary inputs,
So that schema drift and malformed requests fail predictably instead of becoming runtime surprises.

## Review context and evidence

Server/browser Supabase clients have no `Database` generic, and no generated database types were found. Loaders use handwritten rows and casts, so successful TypeScript compilation cannot reliably verify query/column/RPC contracts. Short.io creation annotates `request.json()` as an object without first validating that shape; TypeScript annotations do not validate a request at runtime. Some features already use Zod and should serve as reuse examples.

Entry points:

- `src/utils/supabase/{server,client,middleware}.ts`.
- `src/lib/customer-landing/landing-store.ts`, `src/lib/workshop/application/reconcile-order.ts`: backend client factories.
- `src/lib/{customers,orders,marketing-links}.ts`, Bike Fit/Wiki/Workshop data modules, partner loaders.
- `src/app/api/links/create/route.ts`, other route handlers and `use server` action exports.
- Existing schemas in `src/lib/bike-fit/payload/schema.ts`, `src/lib/wiki/types/schema.ts`, `src/lib/contact-schema.ts`.
- `package.json`, `supabase/migrations/`, any CI introduced since the review.
- [Supabase type generation](https://supabase.com/docs/guides/api/rest/generating-types).

## Scope

- Generate and commit database types from the fully migrated local database and type all Supabase client factories.
- Adapt queries/RPC inputs to derived types; retain intentional presentation/domain DTOs through explicit mappings rather than unsafe blanket casts.
- Inventory externally callable routes/actions and ensure untrusted payloads and IDs have appropriate runtime validation, reusing existing schemas instead of duplicate ad hoc rules.
- Add a reproducible generation/check command and a schema-drift check when CI exists; document the migration/type update workflow.
- Exclude new business validation rules, authorization-policy redesign, and replacement of all domain models with raw database rows.

## Acceptance criteria

### AC1 — Reproducible type generation

**Given** a locally migrated database, **When** the documented generation command runs, **Then** committed generated types accurately represent the used tables, views, enums, and RPC signatures; **And** running it again without schema changes produces no unexplained diff.

### AC2 — Typed clients and query safety

**Given** any browser/server/backend Supabase factory, **When** it is used by application queries, **Then** it carries the generated schema type, invalid typed table/column/RPC arguments are detected where supported, and remaining dynamic/JSON exceptions have explicit narrow validation/mapping rather than broad `any` or `as unknown as` escapes.

### AC3 — Runtime input validation

**Given** malformed JSON, null/array bodies, wrong field types, unsupported enums, or invalid identifiers at a callable boundary, **When** the request/action executes, **Then** it returns the established recoverable validation response before database/vendor mutation and does not crash on unchecked destructuring or method calls.

### AC4 — Existing valid behavior

**Given** valid current payloads and records, **When** loaders, actions, and routes run, **Then** current response shapes, nullable values, pagination, and user-visible behavior remain correct; **And** presentation/domain DTOs remain separate where they intentionally differ from persisted rows.

### AC5 — Schema drift is detectable

**Given** a migration changes a used table/view/RPC contract, **When** local verification or the available CI check runs without updating generated types and affected callers, **Then** it fails with actionable evidence; **And** the documented workflow regenerates types and checks consumers after schema changes.

### AC6 — Boundary protections are preserved

**Given** invalid input, missing sessions, denied roles, or failed reads, **When** typed/validated code handles them, **Then** `withAuth`, RLS, context-prefixed errors, and data-plus-error loader results remain intact; **And** validation does not expose secrets or use service-role clients to bypass denial.

## Implementation notes and constraints

Read `AGENTS.md`. Generate only from local schema; do not apply hosted migrations or inspect secrets to perform generation. Reuse Supabase clients and Zod schemas. Type generation is compile-time assistance, not runtime validation of arbitrary JSON or authorization. For JSONB payloads and external provider responses, preserve or add the appropriate runtime/domain parser.

Keep draft forms permissive where current behavior requires incomplete values; validate safe shape/types without accidentally requiring final-completion fields. Avoid changing product-specific matching/validation semantics while unifying structural validation. Produce a boundary inventory identifying covered endpoints and justified exceptions.

## Verification

- Compile the application with typed factories and run existing relevant tests.
- Use focused negative compile checks for representative invalid queries/RPC arguments; remove deliberately invalid production code.
- Exercise actual boundary handlers with invalid and valid fixtures and assert no mutation on invalid payloads.
- Run type regeneration/drift detection against a disposable schema change, then restore the test environment.

## Decisions at pickup

- Select the canonical generated file and exact command from current CLI help; decide which internal schemas/types need exposure to TypeScript without exposing them via the Data API.
- Inventory boundary-specific schemas and distinguish structural validation from product policy before changing either.

## Independence and coordination

No hard dependency. Use current local migrations; do not wait for Story 1.5. Add a standalone command and integrate with existing CI if present. Later schema-changing stories must regenerate types; earlier completed stories are covered by generating from their actual schema. Story 1.7 owns authorization and Story 1.6 owns financial semantics.

## Completion record

Implementation has not started in this recording task. Record the generation contract, migrated client/query inventory, validated boundaries and exceptions, compile/runtime/drift results, and final status; update the epic index.
