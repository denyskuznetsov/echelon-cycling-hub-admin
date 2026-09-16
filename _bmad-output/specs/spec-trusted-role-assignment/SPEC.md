---
id: SPEC-trusted-role-assignment
companions:
  - provisioning.md
  - brownfield.md
  - verification.md
  - ../../../AGENTS.md
sources:
  - ../../planning-artifacts/stories/project-foundations/1-4-trusted-role-assignment.md
---

> **Canonical contract.** This SPEC and its companions define what to build and verify for Project Foundations Story 1.4. The source story is retained for traceability.

# Trusted account role assignment

## Why

Administrators invite users through Supabase Auth, which creates a profile immediately, then manually assign the necessary role in `public.profiles`. New profiles currently receive mechanic access by default and can also inherit a caller-supplied role. Make the initial profile pending while preserving this invitation-and-assignment process and existing legitimate users. The repository defect is confirmed; production exposure has not been measured.

## Capabilities

- **CAP-1**
  - **intent:** New accounts start without business access until a trusted operator assigns a role.
  - **success:** Sending a dashboard invitation creates the matching profile immediately in the pending state, before acceptance or first login. Forged, absent, malformed, and unsupported role metadata cannot grant role or partner privileges; non-security name fields remain usable.

- **CAP-2**
  - **intent:** A trusted operator can activate the intended staff or partner account with exactly its approved access.
  - **success:** Manual dashboard assignment grants the selected supported role and intended partner association, including before invitation acceptance; ordinary user requests cannot assign either field. Invalid trusted assignments fail without partial activation.

- **CAP-3**
  - **intent:** Pending accounts can wait for activation and log out without using protected business functions.
  - **success:** Pending users can read their own profile and reach the pending screen; direct protected page, action, API, database, RPC, and private-storage requests expose no business data and perform no unauthorized mutation or external action.

- **CAP-4**
  - **intent:** Existing users retain their legitimate access and profile information through the correction.
  - **success:** Existing roles, partner associations, and names survive migration and reapplication; metadata edits cannot change trusted access; established staff permissions and partner isolation still pass behavioral tests.

- **CAP-5**
  - **intent:** Existing and newly initialized environments can adopt the same trusted account boundary safely.
  - **success:** Existing-database upgrade, fresh local initialization, and separate reapplication of the new migration pass the checks in verification.md; hosted schema delivery follows the existing merge/CI process.

## Constraints

- The approved process is send an invitation email in the Supabase Auth dashboard, create the profile immediately, then assign its role in `public.profiles`, including `partner_id` for partners, as defined in provisioning.md.
- Role assignment does not require invitation acceptance or first login. A user whose role is already assigned follows the existing role-based destination after accepting/signing in; only users still lacking a role see pending.
- Authorization continues to use trusted database profile state and the existing `get_user_role`/`withAuth` boundaries. Authentication alone does not authorize business operations.
- Caller-editable metadata cannot assign roles or partner associations at creation or through later updates. No user-facing service-role client or metadata-based authorization replacement is permitted.
- Pending means no protected business access, including through an association-only policy or a direct callable endpoint; it is distinct from a failed profile read or an expired session.
- Preserve the established role permissions, names, partner isolation, Workshop workflow and printing behavior. Reuse existing clients, profile readers, pending UI, and test infrastructure; follow the adopted AGENTS.md.
- Make forward, idempotent schema changes and verify locally. Keep current signup settings and existing assignments intact; hosted inspection is read-only and hosted schema changes use merge/CI.
- This story owns the work needed to deny pending accounts, including shared endpoints. Story 1.7 retains the wider Short.io role-authorization and mutation-outcome correction. No hard dependency on Stories 1.5, 1.7, or 1.8 is introduced.

## Non-goals

- A user-management UI, extra portal approval step, public signup UI, automated provisioning service, new active role, or changed invitation/email flow.
- Blanket reassignment, deletion, or investigation of existing accounts.
- A broader permissions redesign, the full Story 1.7 fix, general database CI, or project-wide type generation.
- Changes to intentionally public pages/media, hosted Auth settings, or live external services as part of verification.

## Success signal

A local test invitation creates a pending profile immediately. If the recipient signs in before role assignment, they see pending and cannot use business functions, even with forged role metadata. If the operator assigns a role before invitation acceptance, the recipient goes directly to the existing destination for that role after accepting/signing in. Both paths pass after fresh initialization and upgrade while existing role fixtures retain access.

## Assumptions

- **A1 — Storage representation:** Use `profiles.role = NULL` for pending, retaining the four existing enum values and the existing pending screen. This technical choice follows the approved behavior; the user did not separately choose its database representation.
