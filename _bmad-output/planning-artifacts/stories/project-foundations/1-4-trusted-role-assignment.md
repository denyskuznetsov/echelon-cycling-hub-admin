---
title: Trusted account role assignment
story_id: '1.4'
epic_id: '1'
review_recommendation: DB-1
requirements: [FR4]
status: done
priority: urgent
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.4: Trusted account role assignment

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review DB-1](../../reviews/project-foundations-review-2026-09-15.md#db-1--make-role-assignment-trusted)

## User story

As an administrator responsible for portal access,
I want account roles assigned only by a trusted provisioning path,
So that a new user cannot obtain staff or admin access by supplying their own role metadata.

## Review context and evidence

`public.handle_new_user` in `supabase/migrations/20260608102505_remote_schema.sql` inserts `profiles.role` using `COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'mechanic'::public.user_role)`. The trigger executes when an Auth user is created. User metadata is caller-controlled, and the default mechanic role also carries access. The current deployed signup/invitation configuration was not verified; the review does not claim an observed production exploit.

Entry points:

- `supabase/migrations/20260608102505_remote_schema.sql`: `handle_new_user`, `on_auth_user_created`, profile enum/table/policies.
- `supabase/migrations/20260609130457_fix_rls_auth_uid_subquery.sql`: `get_user_role`.
- `supabase/config.toml`: local signup configuration.
- `src/lib/profile.ts`, `src/context/UserContext.tsx`, auth helpers, pending/unauthorized routes.
- `supabase/seed.sql` and existing SQL test fixtures: inspect structure without printing exported credentials or row contents.
- [Supabase user metadata guidance](https://supabase.com/docs/guides/auth/users).

## Scope

- Inventory the actual creation/invitation/admin-provisioning paths and choose an explicitly approved safe default or unprovisioned state.
- Remove trust in user-editable metadata for role assignment and validate trusted role values through the chosen provisioning mechanism.
- Preserve established users, legitimate invitation/provisioning behavior, partner association, and non-security profile fields such as names.
- Add database/Auth-boundary regression coverage. Exclude a new user-management UI and blanket reassignment/deletion of existing users.

## Acceptance criteria

### AC1 — Caller metadata cannot elevate privileges

**Given** account creation with caller-controlled metadata requesting `admin`, `manager`, `mechanic`, or another role, **When** the profile is provisioned, **Then** those values cannot grant access; **And** the account receives only the approved safe/default state unless a trusted assignment exists.

### AC2 — Missing and malformed metadata

**Given** missing, malformed, or unsupported role metadata, **When** account creation runs, **Then** the approved safe path is used or a clear controlled failure occurs, without an unsafe role fallback or an unhandled enum-cast failure.

### AC3 — Trusted provisioning remains usable

**Given** an authorized provisioning operation selecting a supported role, **When** the account is created or activated through that path, **Then** it receives exactly the authorized role and intended associations; **And** the same assignment cannot be reproduced through ordinary user metadata or a low-privilege request.

### AC4 — Existing users and metadata updates

**Given** existing admin, manager, mechanic, and partner profiles, **When** the migration runs or those users change non-security metadata, **Then** their legitimate assignments remain unchanged; **And** metadata updates cannot change `profiles.role` through another route or trigger.

### AC5 — End-to-end denial

**Given** a newly created untrusted account, **When** it calls protected routes, actions, or RLS-backed reads/writes directly, **Then** the approved access boundary is enforced beyond the navigation UI; **And** legitimate role fixtures retain their established permissions.

### AC6 — Safe migration and deployment

**Given** an existing database or fresh local stack, **When** the new forward migration is applied and reapplied locally, **Then** provisioning and role checks are correct and repeatable; **And** hosted changes are delivered only through the existing merge/CI path.

## Implementation notes and constraints

Read current `AGENTS.md`. Keep authorization anchored to trusted database role state and existing `get_user_role`/`withAuth` boundaries. Do not replace this with client claims or service-role user-facing reads. Do not assume `app_metadata` is sufficient without proving the chosen writer is trusted. Do not change signup settings or existing role assignments merely to avoid fixing the trigger.

Any check of hosted Auth settings is read-only unless separately authorized. The story is complete only when both the implemented trust boundary and its legitimate provisioning replacement are verified; merely disabling a signup UI is insufficient.

## Verification

- Local Auth integration or equivalent trigger tests with synthetic users covering forged, absent, malformed, and legitimate trusted role assignment.
- Verify resulting `profiles` rows and RLS/action/route behavior; a string assertion on migration SQL alone is insufficient.
- Test the actual creation trigger, metadata updates, migration reapplication, and existing-role preservation.

## Decisions at pickup

- Confirm how legitimate users currently join and how admins assign roles.
- Confirm the safe default: an unprovisioned/no-access state or an approved invitation-only model. Do not silently choose `mechanic` or introduce a new enum/UI workflow without agreement.
- Establish the read-only production signup/invitation posture to assess exposure separately from correcting the repository defect.

## Independence and coordination

No hard dependency. Own necessary provisioning/schema changes and tests; do not wait for Story 1.5's CI or Story 1.8's generated types. Story 1.7 fixes authorization before external side effects and remains a separate required correction even after this story lands.

## Completion record

Implementation began from `ce9318edb80a8ad7fc863e82240cd1798c7b89c7`. The approved provisioning contract is unchanged: a dashboard invitation creates a profile immediately with `role = NULL` and `partner_id = NULL`; a trusted dashboard operator assigns one of the existing roles (and the intended association for a partner) before or after acceptance. The forward migration is `supabase/migrations/20260916084243_trusted_role_assignment.sql`.

Local evidence includes successful migration application/listing, the new 9-assertion database contract suite, the full existing database suite (449 tests across 7 files), TypeScript, pending-layout (4 tests), trusted-role-assignment boundary tests (3 tests), focused affected-file lint except for the pre-existing UserContext hook-rule finding, local security advisors, and whitespace validation. Pending denial and trusted manual assignment are covered locally by the migration/database suites; no external vendor call is made by the runtime checks.

This story is **done**. After the user authorized local recovery, a configured `supabase db reset --local` rebuilt all migrations and `supabase/seed.sql`; that fresh replay applied the trusted-role migration. A seeded upgrade from `20260914120000` preserved the active-role profiles' role/name/association fingerprints (admin 1, manager 1, mechanic 1, partner 2), and direct reapplication of the new migration passed with the focused contract suite. A simulated interrupted migration after its initial nullable-role/trigger/revoke statements recovered when the complete migration was rerun. A real local pending session reached `/pending`, and direct `/workshop?next=/hq` navigation stayed pending; the temporary fixture was removed by the final reset plus seed. User manual testing also passed the mechanic-before-acceptance, pending, manager-after-acceptance, and partner data-isolation flows. No hosted Auth settings or DDL were changed. Hosted schema delivery remains merge plus the existing CI workflows. Story 1.7's broader Short.io authorization and mutation-outcome work remains outstanding.
