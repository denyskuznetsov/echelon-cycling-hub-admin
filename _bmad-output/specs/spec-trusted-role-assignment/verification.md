# Verification and delivery evidence

These are implementation acceptance checks. Creating this spec does not execute or satisfy them. Use synthetic accounts and local/disposable databases; capture invitation emails in local test infrastructure and stub external providers so tests cannot send real email, create links, or synchronize live data.

## Source acceptance coverage

| Source criterion | Spec capability | Required evidence |
| --- | --- | --- |
| AC1 — Caller metadata cannot elevate privileges | CAP-1, CAP-3 | Actual creation trigger ignores every supported and forged role, including invitation creation; resulting account cannot use protected business functions |
| AC2 — Missing and malformed metadata | CAP-1 | Missing/null/invalid metadata creates pending safely without enum-cast failure |
| AC3 — Trusted provisioning remains usable | CAP-2 | Dashboard invitation immediately creates a profile; manual assignment can precede acceptance and activates all four roles; ordinary sessions cannot reproduce it |
| AC4 — Existing users and metadata updates | CAP-4 | Preexisting role/name/association fixtures survive upgrade; metadata updates do not alter authority |
| AC5 — End-to-end denial | CAP-3, CAP-4 | Direct page/action/API/RLS/RPC/private-storage denial and positive legitimate-role checks |
| AC6 — Safe migration and deployment | CAP-5 | Existing-state upgrade, fresh replay, separate reapplication, and merge/CI handoff evidence |

## Required scenarios

| Scenario | Expected result |
| --- | --- |
| Send a dashboard invitation to a synthetic user | Matching profile exists immediately with null role and no association, before the invite is accepted or the user signs in |
| Assign a supported role to the invited profile before acceptance, then accept and sign in | Assignment survives acceptance; user reaches the existing destination and permissions for that role without an extra pending/approval step |
| Accept the invitation and sign in before role assignment | Pending screen, logout available, no business access; after trusted assignment, reload/sign-in gives the intended access |
| Create users with metadata role `admin`, `manager`, `mechanic`, or `partner`, including a claimed `partner_id` | Existing trigger executes; matching profiles have null role and no association; no business access |
| Create with absent role, JSON null, empty/unknown string, array, object, number, or boolean; also omit metadata | Pending result, no unsafe fallback, no unhandled role cast; safe names survive when supplied |
| Update user metadata to request a new role or partner, both before and after activation | Trusted profile security fields do not change; ordinary name metadata changes do not revoke the approved role |
| Direct insert/update/upsert of profile security fields under pending, mechanic, partner, manager, and admin user sessions | No unauthorized row/security-field mutation, including through callable functions; verify stored values, not just response errors |
| Trusted assignment for each of the four roles | Exact intended Auth UUID/profile changes, saved role is correct, and existing permissions work |
| Trusted partner assignment | Correct association saved with role; only intended partner data visible; another partner and internal staff data stay inaccessible |
| Invalid trusted role or partner reference | Clear rejected write with prior values intact; no partial activation |
| Pending profile with a partner association | Database rejects the invalid state or still denies all business access; association-only SELECT rules cannot expose rows |
| Pending sign-in, direct protected URL, and a protected `next` destination | Pending screen with logout; no business content or redirect loop |
| Pending own-profile read, failed profile read, and expired session | Own profile is readable; a failure is surfaced distinctly; session expiry keeps the login boundary |
| Pending direct user-facing API or server action | Authorization failure before business mutation or vendor invocation; vendor call count is zero, including Short.io and contact email |
| Pending direct tables, views, reporting and Workshop RPCs, and private-storage operations | No forbidden data or successful writes, even when a known entity ID is supplied |
| Existing admin, manager, mechanic, and partner fixtures after migration and reapplication | Their original roles, names, associations, and legitimate permissions remain; partner isolation and mechanic write restrictions remain |

Test the Auth insertion trigger before any test helper assigns a role. A fixture that overwrites the role immediately cannot prove the default is safe. Use actual local Auth integration or equivalent trigger execution for metadata creation cases; exercise the local invitation path and real authenticated requests where invitation/session/API behavior is under test.

## Coverage inventory

Before implementation is marked complete, enumerate the protected surfaces in the current checkout and record a denial result for each category:

- Page families: HQ, all partners, orders, customers, Bike Fit, Wiki, Workshop, partner self/slug areas, and contact.
- Callable actions/APIs: profile/security writes, application mutations, partner reports and actions, marketing links, contact email, and manual synchronization.
- Database access: protected tables/views, exposed RPCs, association-based partner reads, and private storage. Check function execution grants and internal authorization as well as table RLS.

Preserve webhook-specific authentication and existing public-content access. Fix missing pending guards where found; do not treat hidden navigation or one representative redirect as complete proof.

## Migration checks

1. **Existing state:** Create synthetic pre-migration users covering all four roles, names, and partner associations; apply the forward migration and verify preservation and safe new-account creation.
2. **Fresh state:** Replay migrations into a disposable local database, then create synthetic users and test the contract without depending on exported seed identities.
3. **Reapplication:** Re-execute the new migration separately against its already-applied state, including relevant partially-applied setup, and repeat the critical assertions. A fresh reset alone does not prove idempotence.
4. **Regressions:** Run the existing six SQL suites, focused runtime Auth/route/action tests, TypeScript, and lint on affected code. Document commands and results; separate unrelated baseline failures from this change.

Discover current CLI flags before use and target local explicitly. The existing database test script is `npm run test:db` (`supabase test db --local`). A shared local reset is not authorized by this spec.

## Completion evidence

- Record the implementation baseline, chosen enforcement details, changed files, and migration names.
- Include a local dashboard walkthrough: send invitation → verify immediate pending profile → assign role and association before acceptance → accept/sign in → verify the intended role's permissions. Also verify acceptance before assignment. Deliver invitation email only to local test infrastructure.
- Record the runtime and database checks above, including failures or remaining coverage gaps. The story is not complete until both denial and legitimate provisioning work.
- The user has confirmed dashboard invitation followed by manual profile-role assignment. Separately record hosted signup/provider settings through read-only inspection, or state the precise access limitation. Keep this exposure evidence outside product decisions; do not change Auth settings or claim an observed exploit.
- Hand off hosted schema changes through the existing branch merge/CI process. Manual dashboard account provisioning is ordinary operational data entry, not permission to apply hosted DDL.
- Update the source story's completion record and epic status when implementation actually completes. Keep Story 1.7's outstanding authorization work explicit.
