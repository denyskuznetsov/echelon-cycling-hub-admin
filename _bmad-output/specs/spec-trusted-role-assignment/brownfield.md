# Current code and implementation boundaries

Inspected on 2026-09-15 at commit `8b2bc2f60741c4dd7b1c974c58ad64bdf869baf2`. These are repository observations, not live database or hosted verification. Recheck affected definitions at implementation pickup.

## Entry points

Paths below are relative to the repository root.

| Area | Evidence and required attention |
| --- | --- |
| Auth creation | `supabase/migrations/20260608102505_remote_schema.sql`: `handle_new_user` casts `raw_user_meta_data.role`, defaults to mechanic, and is called by `on_auth_user_created` after insertion into `auth.users` |
| Profile schema | The same migration defines four role enum values, `profiles.role NOT NULL DEFAULT 'mechanic'`, and nullable `partner_id`; remove both sources of automatic mechanic assignment in a new migration |
| Database role lookup | `supabase/migrations/20260609130457_fix_rls_auth_uid_subquery.sql`: `get_user_role` reads the profile for `auth.uid()`; keep this authority |
| Profile writes | Baseline profile RLS has read policies, with no application profile-write policy found in the inspected migrations; preserve the separation between dashboard writes and ordinary user sessions |
| Partner association access | Partner/order/customer policies in the June baseline and RLS correction, order-item policies in `20260610151000_add_order_items_and_payment_fields.sql`, and marketing-link SELECT in `20260722130326_create_marketing_links_table.sql` use association predicates; verify pending cannot inherit these reads |
| Server profile reader | `src/lib/profile.ts` already returns nullable role plus error; a missing profile is currently a `.single()` error, distinct from an existing null-role profile |
| Client profile context | `src/context/UserContext.tsx` currently types `Profile.role` as non-null; adapt the type and consumers to the pending representation without hiding load errors |
| Landing and pending UI | `src/utils/auth/postLogin.ts`, `src/app/pending/page.tsx`, and `src/app/pending/layout.tsx` already support a pending destination and logout. Current executable destinations are admin/manager → `/all-partners`, mechanic → `/workshop`, partner → `/partner`; comments mentioning `/hq` are stale |
| Direct page access | Review protected layouts, including `src/app/wiki/layout.tsx`, which currently redirects a null role to `/login`; preserve valid pending identity and avoid redirect loops |
| Session wrapper | `src/utils/auth/with-auth.ts` validates the session only; it does not authorize business operations |
| External operations | `src/app/api/links/create/route.ts` and `src/lib/contact.ts` can reach Short.io/Resend after authentication without a role check; pending denial must precede these calls |
| Related endpoints | Include `src/lib/marketing-links-actions.ts`, partner report downloads, partner loaders/actions, Bike Fit/Wiki actions, and Workshop APIs/actions in the direct-call inventory; layout denial does not prove callable denial |
| Workshop database helpers | `private.workshop_begin_command`, `private.workshop_task_detail`, and `private.workshop_staff_or_forbidden` explicitly reject null roles in the inspected migrations; preserve those guards, versions, stage rules, and leases |
| Reporting RPC | `get_partner_daily_stats` is security-invoker SQL over orders; preserve RLS enforcement and test pending calls as part of the exposed RPC inventory |
| Local Auth | `supabase/config.toml` enables local signup and email signup and disables anonymous sign-in; this says nothing about production settings |
| Existing fixtures | All six `supabase/tests/database/*.test.sql` suites create synthetic Auth users and explicitly assign profile roles afterward; do not rely on metadata to create privileged test fixtures |
| Seed | `supabase/seed.sql` contains exported Auth/identity/profile inserts. Inspection was limited to statement headers and column names; exported identities and credentials are not test fixtures |
| Deployment | `.github/workflows/deploy-staging.yml` and `deploy-production.yml` push migrations on their configured branches; retain that hosted delivery path |

No in-app account-creation, invite, or Auth-admin provisioning call was found in `src` or `scripts`. The user confirmed that sending a dashboard invitation immediately creates a profile, which they then edit to assign the necessary role. Preserve that timing and process while changing the initial mechanic role to pending.

Production's intended onboarding process is confirmed by the user. Other hosted signup/provider settings have not been inspected; any read-only exposure assessment belongs in implementation evidence, not an open onboarding decision. Do not infer that self-signup is disabled or claim a production exploit from this clarification.

## Migration and implementation shape

- Add a forward migration replacing the creation function's role behavior and removing the profile column's mechanic default and non-null restriction. Keep the Auth trigger bound to the safe function at identity creation, including invitation time; preserve its restricted execution and qualified object references.
- Audit role/association mutation paths, exposed functions, grants, and pending authorization. Add only the enforcement needed for this contract; no new provisioning endpoint or active enum value is required.
- RLS remains enabled. Any policy/trigger replacement follows the idempotent conventions in the adopted AGENTS.md. Do not rewrite old migrations or use privileged clients in user-facing code.
- Keep synthetic fixtures' trusted assignments explicit. Regenerate local schema types if generated types exist by implementation time; introducing them is Story 1.8's scope.
- Tests and required schema changes belong to this story. Do not wait for Story 1.5's database gate or claim its broader seed/bootstrap cleanup is complete.
- No database was reset, migrated, or queried during this spec run. Use a disposable local environment for fresh-state checks; resetting a shared developer database requires its own authorization.

## Supporting documentation

- [Supabase users](https://supabase.com/docs/guides/auth/users): user metadata is editable by the user and must not supply authorization; dashboard invitations are a trusted administrative action, but their user metadata is still not an authorization source.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data): a profile creation trigger can fail account creation, so verify its actual execution with malformed input.
- [Data API grant changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): grants and RLS are separate. Preserve deliberate access grants and do not infer them from environment defaults. This contract does not require a new table or platform upgrade.

The relevant source context is [review DB-1](../../planning-artifacts/reviews/project-foundations-review-2026-09-15.md#db-1--make-role-assignment-trusted) and the epic's FR4, authorization, migration-safety, and independent-delivery requirements. Historical review test results are not evidence that this spec has been implemented.
