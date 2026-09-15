---
title: Reproducible database and migration gate
story_id: '1.5'
epic_id: '1'
review_recommendation: DB-2
requirements: [FR5]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.5: Reproducible database and migration gate

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review DB-2](../../reviews/project-foundations-review-2026-09-15.md#db-2--make-database-recreation-and-migration-validation-mandatory)

## User story

As a developer or operator preparing a release,
I want required database/storage setup to be reproducible and migrations verified before deployment,
So that a fresh environment works and schema changes fail early instead of during a hosted release.

## Review context and evidence

Both deployment workflows link a hosted project and run `supabase db push` without a prior local reset or SQL-test gate. Six pgTAP suites exist. Required `bike-fit-images` bucket creation is in `seed.sql`, while application storage and migration policies depend on it. The seed also contains exported Auth/application rows and storage-object metadata; a database row alone does not recreate the corresponding storage file bytes.

Entry points:

- `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`.
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/`.
- `supabase/tests/database/{workshop_foundation,workshop_source_apply,workshop_sync,workshop_queue,workshop_task_addons,customer_sync}.test.sql`.
- `src/lib/bike-fit/storage/storage.ts`, `src/lib/wiki/storage/storage.ts`.
- `package.json`: existing `test:db` command.

## Scope

- Put required schema, storage bucket configuration, policies, grants, and application configuration data under forward migrations.
- Replace exported Auth/customer/application data with minimal deterministic synthetic local fixtures, using supported local setup paths and avoiding copied Auth flow/session material.
- Verify fresh migration replay without optional sample data, upgrade from a prior schema, SQL contracts, and safe reapplication of new migrations in isolated CI.
- Gate hosted deployment on those checks while retaining the existing staging/main branch delivery model.
- Exclude remote resets, ad hoc hosted DDL, blanket migration-history rewriting, and copying real customer files into CI.

## Acceptance criteria

### AC1 — Required setup without sample seed

**Given** an empty disposable database with optional sample seeding disabled, **When** all repository migrations run, **Then** required schemas, functions, grants/policies, configuration rows, and storage buckets exist; **And** representative authorized storage/database operations work without importing exported business records.

### AC2 — Synthetic local development data

**Given** the documented local fixture setup, **When** it runs, **Then** developers obtain the required synthetic role and feature scenarios without copied customer records, recovery/session material, or production credentials; **And** storage examples are either actual synthetic files or explicitly absent, not dangling metadata presented as working uploads.

### AC3 — Fresh and upgrade paths

**Given** both a clean database and a disposable database at the prior migration baseline, **When** the branch migrations are applied, **Then** both reach the same intended schema and pass the applicable SQL contracts, with representative existing data preserved on the upgrade path.

### AC4 — New-migration reapplication

**Given** each new migration in the change under test, **When** its SQL is reapplied in an isolated database, **Then** it succeeds without duplicate policy/constraint/trigger failures or duplicate configuration data; **And** the method does not rewrite hosted history or blindly replay the entire historical dump against a populated schema.

### AC5 — SQL behavior tests are enforced

**Given** the database validation job, **When** pgTAP detects a schema, RLS, command, or replay regression, **Then** CI fails and the deployment workflow cannot proceed; **And** a passing branch runs the existing suites plus the required setup/migration regressions.

### AC6 — Safe deployment sequencing

**Given** staging or main receives a change, **When** its deployment executes, **Then** database validation succeeds before the hosted push, the intended environment is selected, and any failed prerequisite prevents that push; **And** PR validation requires no hosted database secrets.

### AC7 — Developer operating instructions

**Given** a fresh checkout and documented prerequisites, **When** a developer follows the database setup/verification guide, **Then** the commands are reproducible and clearly distinguish disposable reset, optional fixtures, migration validation, and merge/CI deployment.

## Implementation notes and constraints

Read `AGENTS.md`. Author forward, idempotent SQL with explicit grants and RLS; apply only to local/disposable databases. Preserve already-deployed migration files/history. The baseline dump contains one-time DDL; document its bootstrap role rather than pretending all historical SQL can safely be rerun over existing objects. Required bucket changes must preserve the intended private/public posture and existing permissions.

Discover current Supabase CLI commands with `--help`. Reset only a disposable instance whose data is owned by the test. Preserve unrelated local developer data and user changes. Keep synthetic fixture ownership separate from production provisioning.

## Verification

- Run migration-only bootstrap, optional synthetic seeding, previous-baseline upgrade, and new-migration reapplication in disposable local stacks.
- Execute all SQL suites and representative RLS/storage operations as intended roles.
- Demonstrate a failed database check blocks the hosted-push step using safe workflow/test evidence, without intentionally breaking a real deployment.

## Decisions at pickup

- Inventory all required setup currently hidden in seed or manual configuration; the bucket example is a starting point.
- Choose minimum synthetic scenarios and a reproducible prior-baseline/reapplication test strategy. Record required local services and CI isolation.

## Independence and coordination

No hard dependency. Own database CI, migrations/setup, and fixtures. Story 1.3 owns application/browser checks; reuse its fixture conventions if present, but supply needed database fixtures independently. Every other schema-changing story continues to own its own migrations and tests.

## Completion record

Implementation has not started in this recording task. Record required setup inventory, fixture design, migration files, reset/upgrade/reapplication results, CI/deployment sequencing evidence, and final status; update the epic index.
