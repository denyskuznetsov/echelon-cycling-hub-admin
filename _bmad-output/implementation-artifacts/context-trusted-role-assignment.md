# Trusted role assignment: implementation investigation

Inspected 2026-09-15 at `ce9318edb80a8ad7fc863e82240cd1798c7b89c7` on `feature/implement-the-frist-urgent-story-from-foundational-review`. Working tree was clean. This is investigation and execution guidance, not implementation evidence. The canonical SPEC and companions remain authoritative.

## Database map

Migration paths below are under `supabase/migrations/`. Author a new forward migration; do not edit historical files.

| File and anchor | Required attention |
| --- | --- |
| `20260608102505_remote_schema.sql:131` | Replace `handle_new_user`: explicit null role and association, existing name extraction, qualified identifiers, pinned empty search path and restricted execution. Never cast metadata role. |
| Same file `:404`, `:1035` | Drop profile role default and NOT NULL; preserve creation trigger timing at Auth insertion, including invitations. |
| Same file `:580`, `:585` | Existing Auth/partner foreign keys and role enum validate trusted values; test failed assignment atomically. |
| `20260609130457_fix_rls_auth_uid_subquery.sql:39` | Preserve `get_user_role` as authority. Profile policies are SELECT-only; test effective grants and RLS for ordinary INSERT/UPDATE/UPSERT under every role. |
| Same file `:9`, `:18`, `:27` | Partner, order, customer association-only policies need active-role predicates. |
| `20260610151000_add_order_items_and_payment_fields.sql:43` | Order-item association policy needs active-role predicate. |
| `20260722130326_create_marketing_links_table.sql:34` | Marketing-link association policy needs active-role predicate. |
| `20260708120000_add_onboarding_completed_at.sql:13` | `acknowledge_onboarding` is a callable SECURITY DEFINER mutation without a role guard. Deny pending inside SQL as well as the action. |

Use `get_user_role() IS NOT NULL` alongside existing association tests to deny pending while preserving current active-role behavior, including unusual existing associations. This allows testing a pending profile with an association without exposing business data. Do not add unrelated constraints that invalidate established rows. Trusted partner provisioning saves role and intended association together; invalid references fail through the existing FK.

Existing business views (`bike_fits_view`, `bookings_view`, `partner_customers_view`, `wiki_documents_view`) use security-invoker. `get_partner_daily_stats` uses invoker SQL over orders; verify repaired RLS through direct calls. Inventory current effective grants and callable definitions locally rather than assuming migration text proves access.

Workshop foundation helpers `private.workshop_begin_command`, `private.workshop_task_detail`, and staff guards already reject null roles. Source-apply/lease functions are restricted to service role. Preserve command versions, stage rules, leases and printing behavior.

Private bike-fit storage policies explicitly allow staff roles; mechanic SELECT comes from `20260904130000_mechanic_customer_read_access.sql:91`. Test known-path reads, signed URL creation, uploads, replacement and deletion with real pending sessions. Wiki images deliberately use public delivery; preserve that access and existing role-based write denial.

## Application map

| File and anchor | Implementation action |
| --- | --- |
| `src/context/UserContext.tsx:21`, `:185` | Make role nullable and guard role before `includes`. |
| `src/ui/layouts/nav-config.ts:75` | Accept null roles; `DefaultPageLayout.tsx:34` passes profile role. Preserve empty pending navigation and logout. |
| `src/lib/profile.ts:22` | Reuse data-plus-error reader. Missing authentication also returns null, so callers requiring identity distinction must verify session. |
| `src/utils/auth/postLogin.ts:28` | Separate valid pending from failed/missing profile; preserve active landing destinations. Update callers coherently. |
| `src/app/wiki/layout.tsx:23` | After authentication, send null role to pending instead of login; surface profile failure. |
| `src/app/{hq,all-partners,orders,customers,bike-fits,workshop,contact}/layout.tsx` | Separate profile read failure from pending. Preserve role allowlists. |
| `src/app/partner/_lib/resolvePartner.ts:22` | Return profile query errors explicitly and consume them in partner self/slug layouts. |
| `src/app/pending/layout.tsx:17`, `page.tsx:1` | Reuse pending screen/logout; display actual profile failures distinctly. |
| `src/app/auth/callback/route.ts:34`, auth login/anonymous guards | Test protected `next` with pending session for loops; preserve assigned-role destinations. |
| `src/app/api/links/create/route.ts:6` | Add pending 403 and distinct profile failure immediately after auth, before database/vendor work. |
| `src/lib/contact.ts:21` | Return recoverable pending denial before Resend construction or invocation. |
| `src/lib/marketing-links-actions.ts:15` | Reject pending before link reads/vendor deletion. |
| `src/app/api/partners/download-report/route.ts:43` | Add explicit missing-session 401 and pending 403 before report work. Preserve authorized RLS and reporting behavior. |
| `src/app/partner/_lib/onboarding-actions.ts:9` | Deny pending using existing result convention; SQL guard is also required. |
| `src/app/partner/_lib/marketing-links-action.ts:15` | Reject pending with empty links plus authorization error before loading. |
| `src/lib/customers/actions/customer-details-actions.ts:15`, `src/lib/orders/actions/order-details-actions.ts:12` | Reject pending read actions with null entity plus error. |
| `src/lib/wiki/actions/wiki-actions.ts:37`, `wiki-category-actions.ts:40` | Guard each exported mutation before business work, retaining affected-row checks and error shapes. |
| `src/lib/bike-fit/actions/bike-fit-actions.ts:33`, `report-actions.ts:25` | Existing admin/manager checks reject pending; exercise actual calls. |
| `src/lib/workshop/actions/task-actions.ts:18`, `sync-actions.ts:17` | Verify existing RPC/orchestration authorization and structured denial. |
| `src/app/api/sandbox/booqable/sync-orders/route.ts:25` | Existing admin/manager check returns 403 before sync; verify with vendor stubs. |

`withAuth` authenticates; keep operation authorization separate. Results vary between actions, so do not impose a global generic failure shape. Story 1.7 still owns complete Short.io admin/manager authorization and mutation-outcome handling.

## Verification setup

- Six existing SQL suites create synthetic Auth users and assign roles explicitly. New trigger tests must inspect pending state before trusted assignment.
- Node `.test.mts` runner and integration-style dependency stubs exist. Existing pending-layout tests mostly assert source text; add executed routing/action tests. No shared Playwright/Vitest/Jest configuration or generated schema types was found.
- Add `src/trusted-role-assignment.test.mts` for callable-boundary behavior and `supabase/tests/database/trusted_role_assignment.test.sql` for database contracts.
- Use a disposable local stack/database with synthetic data for fresh replay, pre-migration fixtures, partial-state recovery, and separate reapplication. Do not reset the shared developer database or use exported seed identities.
- Perform the dashboard provisioning walkthrough before and after trusted assignment. Verify activated destinations and partner isolation. Stub external vendors, including contact email.
- Record denial for every page/action/API/database/RPC/private-storage category from the canonical verification inventory, plus positive active-role controls.
- Run existing six SQL suites, focused runtime tests, TypeScript, and affected-file lint. Record each matrix row's covering test and passing execution.

## Preflight evidence

`supabase migration list --local` succeeded: all 28 repository migrations through `20260914120000` match the local database. CLI v2.105.0; help confirms explicit `--local` for migration listing and database tests. Initial sandbox execution failed writing CLI telemetry outside the workspace; reviewed escalation resolved it. This was not a database/test failure.

No schema, Auth identities, or hosted state changed during planning. No implementation tests ran. Hosted signup/provider settings remain uninspected; build workflow disallows remote operations, so record that access/workflow limitation rather than claiming observed production exposure. Current Supabase users and user-management documentation was consulted; changelog Markdown fetch was unavailable through web extraction and sandbox curl DNS.

## Completion record

Implementation started 2026-09-16 from baseline `ce9318edb80a8ad7fc863e82240cd1798c7b89c7` on `feature/implement-the-frist-urgent-story-from-foundational-review`. The forward migration is `20260916084243_trusted_role_assignment.sql`. It leaves existing profiles untouched, makes new Auth-trigger profiles pending (`role = NULL`, `partner_id = NULL`), drops the automatic mechanic default and non-null constraint, revokes ordinary profile writes, protects association-only policies with an active-role predicate, and rejects pending calls to `acknowledge_onboarding`.

Application work makes role nullable in the client context/navigation, distinguishes failed profile reads from valid pending state, sends pending users through the existing `/pending` destination, and adds early pending guards to the callable boundaries identified above. The new database suite is `supabase/tests/database/trusted_role_assignment.test.sql`; the runnable boundary suite is `src/trusted-role-assignment.test.mts` through `npm run test:trusted-role-assignment`.

Completed local evidence:

- `supabase migration up --local` applied the forward migration, and `supabase migration list --local` confirmed it.
- `supabase test db --local supabase/tests/database/trusted_role_assignment.test.sql` passed 9 assertions; `npm run test:db` passed 449 tests across 7 files.
- `npx tsc --noEmit`, `npm run test:pending-layout` (4 tests), `npm run test:trusted-role-assignment` (3 tests), focused ESLint on modified files other than the pre-existing UserContext hook finding, `supabase db advisors --local --type security --level warn`, and `git diff --check` passed.

The local database was reset with the configured `supabase/seed.sql` after the user explicitly authorized recovery. Fresh replay applied all 29 migrations including `20260916084243_trusted_role_assignment.sql`. For the upgrade check, the stack was reset and seeded through `20260914120000`, the four seeded active-role groups were fingerprinted by role, id, names, and partner association, then the forward migration was applied. The before/after fingerprints matched for admin (1), manager (1), mechanic (1), and partner (2). The migration was then executed directly against its already-upgraded schema and the focused 9-assertion database suite passed again.

Manual browser results provided by the user: dashboard provisioning immediately created a profile with null role and partner; assigning mechanic before acceptance reached `/workshop`; pending sign-in reached `/pending` with logout; direct `/workshop?next=/hq` stayed pending; assigning manager after acceptance reached `/hq`; and the partner flow, including partner-only data isolation, passed.

Partial-state recovery was then exercised by resetting and seeding through `20260914120000`, applying only the initial 31 lines of the forward migration (nullable role, safe trigger replacement, and profile-write revoke), then rerunning the entire migration. The focused contract suite passed; the final reset restored the complete current migration set plus `supabase/seed.sql`.

For a real local session check, one seeded account was temporarily made pending and given a temporary local-only password. It signed in to the running application and visibly reached `/pending`; a direct `/workshop?next=/hq` request remained at `/pending` without business navigation. A final `supabase db reset --local` reapplied all migrations and `supabase/seed.sql`, removing that temporary test-only mutation; migration history and the focused contract suite passed afterward.

This story is **done**. Production Auth configuration was neither changed nor inspected. Deliver the authored migration through the existing branch merge and CI workflow only. Focused lint including `src/context/UserContext.tsx` still reports the pre-existing `react-hooks/set-state-in-effect` issue at the existing `loadInitial()` call (line 119), and Node emits its existing `MODULE_TYPELESS_PACKAGE_JSON` warning.
