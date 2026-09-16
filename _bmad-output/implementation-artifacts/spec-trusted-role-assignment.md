---
title: 'Trusted account role assignment'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
approved: '2026-09-16'
baseline_commit: 'ce9318edb80a8ad7fc863e82240cd1798c7b89c7'
story_id: '1.4'
epic_id: '1'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-trusted-role-assignment/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-trusted-role-assignment/provisioning.md'
  - '{project-root}/_bmad-output/specs/spec-trusted-role-assignment/brownfield.md'
  - '{project-root}/_bmad-output/specs/spec-trusted-role-assignment/verification.md'
  - '{project-root}/_bmad-output/implementation-artifacts/context-trusted-role-assignment.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Auth creation trusts caller role metadata and defaults to mechanic access.

**Approach:** Implement the supplied [canonical contract](../specs/spec-trusted-role-assignment/SPEC.md) and all companions. Dashboard invitations immediately create pending profiles; trusted dashboard writes activate them, including before acceptance. The canonical contract remains binding.

## Boundaries & Constraints

**Always:** Use nullable `profiles.role`, existing role lookup, RLS, clients, pending UI, and `withAuth`. Preserve names, existing assignments, legitimate permissions, partner isolation, public content, and Workshop behavior. Distinguish profile failures from pending and session expiry.

**Ask First:** Changes to the agreed provisioning process or scope; destructive shared-database recovery.

**Never:** Metadata authorization, user-facing privileged clients, new provisioning UI, hosted DDL/settings changes, live vendor effects, or completion claims for Stories 1.5/1.7/1.8.

## I/O & Edge-Case Matrix

The full required scenario table in [verification](../specs/spec-trusted-role-assignment/verification.md) remains binding.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Creation | Invitation; forged, absent, malformed metadata | Immediate null role/association; safe names | No enum-cast failure |
| Activation | Four supported roles; partner association | Exact UUID assigned; correct access before/after acceptance | Invalid writes fail atomically |
| Escalation | Ordinary profile writes or metadata edits | Security fields unchanged for every role | Denied writes visible |
| Pending | Valid session, including protected next URL | Pending and logout; own profile only | APIs 403; recoverable action denial; zero vendor calls |
| Failures | Expired session or failed profile read | Login/401 or distinct read error | No redirect loop or false pending state |
| Database | Pending, including associated profile | No protected table/view/RPC/storage access | Invalid association state rejected or access denied |
| Preservation | Existing users; upgrade/fresh/reapplication | Names, assignments and legitimate permissions retained | Report failures separately |

</frozen-after-approval>

## Code Map

See [current investigation](context-trusted-role-assignment.md) for anchored files, callable inventory, reuse points, and validation setup. Recheck definitions before editing.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/` — create a forward migration with the CLI; remove automatic roles, secure creation and ordinary security-field writes, enforce pending isolation, and guard callable database mutations. Preserve existing rows.
- [x] `src/context/UserContext.tsx`, `src/lib/profile.ts`, `src/utils/auth/postLogin.ts`, protected layouts and login callers listed in the Code Map — represent nullable roles, preserve destinations, and surface profile errors distinctly.
- [x] `src/lib/contact.ts`, `src/lib/marketing-links-actions.ts`, `src/app/partner/_lib/onboarding-actions.ts`, link/report routes and inventoried callable boundaries — deny pending before business work using existing result/auth conventions.
- [x] `supabase/tests/database/trusted_role_assignment.test.sql` — execute trigger, metadata, trusted assignment, denied writes, and pending/legitimate-role scenarios at their owning boundaries.
- [x] `src/trusted-role-assignment.test.mts`, `package.json` — add runnable boundary tests and verify upgrade, fresh replay, partial-state recovery, and separate reapplication.
- [x] `_bmad-output/implementation-artifacts/context-trusted-role-assignment.md`, `_bmad-output/planning-artifacts/stories/project-foundations/1-4-trusted-role-assignment.md` and `_bmad-output/planning-artifacts/epics.md` — record coverage, commands, baseline, migration, provisioning walkthrough, hosted-inspection limitation, and actual completion status.

**Acceptance Criteria:**
- Given the canonical contract, when the implementation is exercised, then every required verification scenario passes with both pending denial and legitimate provisioning evidence.
- Given current and disposable local databases, when migration validation runs, then existing-state upgrade, fresh replay, partial-state recovery and separate reapplication preserve the contract.
- Given completion, when reviewing the handoff, then all protected categories have recorded results, outstanding limitations remain explicit, and hosted delivery uses merge/CI.

## Spec Change Log

- 2026-09-16 — Completed the trusted-role implementation and verification.
  Production Auth configuration remains out of scope and unchanged.

## Session Handoff

The user approved this build spec on 2026-09-16. The approved intent block is
frozen. Implementation began from `ce9318edb80a8ad7fc863e82240cd1798c7b89c7`
and the local forward migration is applied. Seeded fresh replay, upgrade,
partial-state recovery, direct reapplication, automated boundary/database
checks, and the approved manual provisioning/partner checks are complete.

## Verification

- Passed: `npm run test:db` (7 suites / 449 assertions), focused pgTAP (9),
  `node --test src/trusted-role-assignment.test.mts` (3),
  `npm run test:pending-layout` (4), `npx tsc --noEmit`, `git diff --check`,
  and local Supabase security advisors.
- Passed: seeded fresh replay; seeded upgrade from `20260914120000` with
  unchanged active-role profile fingerprints; direct reapplication of
  `20260916084243_trusted_role_assignment.sql`; and the focused database suite
  after each applicable lifecycle step. A real local seeded pending session
  reached `/pending`, and direct `/workshop?next=/hq` navigation remained at
  `/pending` without business navigation. Applying only the early migration
  statements to seeded pre-change state and then rerunning the complete SQL
  also passed, proving partial-state recovery.
- Passed manually: profile creation is pending at invitation time; mechanic
  assignment before acceptance reaches `/workshop`; pending sign-in and direct
  Workshop access remain at `/pending`; manager assignment after acceptance
  reaches `/hq`; and the partner flow and partner-data isolation pass.
- Scope note: no production Auth configuration was changed or inspected;
  production continues to use its established PKCE flow.
- Focused ESLint otherwise passed; the existing `src/context/UserContext.tsx:119`
  effect-rule failure and Node module-type warning are recorded separately.
