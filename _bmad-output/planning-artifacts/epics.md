---
title: Project Foundations — Epic and Stories
type: epic-breakdown
status: backlog
created: '2026-09-15'
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
validation_status: complete-for-backlog
implementation_readiness: 'Refine the selected story and resolve its listed decisions before implementation.'
inputDocuments:
  - '_bmad-output/planning-artifacts/reviews/project-foundations-review-2026-09-15.md'
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-echelon-cycling-hub-admin-2026-08-20/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/spec-shared-submit-search.md'
workflow: bmad-create-epics-and-stories
workflow_mode: 'User-directed review-to-backlog recording; one epic and nine stories explicitly selected by the user.'
planning_artifacts: '_bmad-output/planning-artifacts'
---

# Echelon Cycling Hub — Project Foundations

## Overview

Capture the [2026-09-15 review](reviews/project-foundations-review-2026-09-15.md) as exactly **one epic with nine independently usable stories**, one per recommendation. Improve the fundamentals that new features reuse: frontend interaction/save behavior, database ownership and reproducibility, and authenticated, typed, reliable API boundaries.

The user selected the review as the requirements source and fixed the decomposition. This is backlog recording, not a new product discovery or implementation approval. No separate project-wide PRD or UX contract was supplied for this maintenance epic. The feature-specific Workshop architecture supplies applicable invariants only; its historic upgrade targets and completed feature work do not become new requirements. The merged BMad configuration resolves planning artifacts to `_bmad-output/planning-artifacts`. No `project-context.md` was found.

## Requirements Inventory

### Functional Requirements

- **FR1 / FE-1:** Lists share URL navigation, filter/page reset, history, and table-local pending behavior while preserving the existing explicit-submit search implementation.
- **FR2 / FE-2:** Editors share a reliable save lifecycle with serialized writes, explicit save/failure states, and stale-record protection.
- **FR3 / FE-3:** Application checks catch lint, type, and critical browser-behavior regressions before merge.
- **FR4 / DB-1:** New account roles come from trusted provisioning; caller-controlled signup metadata cannot grant privileges.
- **FR5 / DB-2:** Migrations recreate required database/storage configuration without exported seed data, and CI verifies migration replay and SQL contracts before deployment.
- **FR6 / DB-3:** Dashboard and export use the same PostgreSQL-owned reporting calculations, and exports retrieve the full authorized result set beyond a single API page.
- **FR7 / API-1:** Short.io mutations require the appropriate role before external side effects, and database mutation outcomes are checked.
- **FR8 / API-2:** Supabase query types derive from local schema, and untrusted boundary payloads receive runtime validation.
- **FR9 / API-3:** External requests have bounded deadlines/retries, and customer-sync destination outcomes are preserved independently.

### NonFunctional Requirements

- **NFR1 — Authorization:** Preserve partner isolation, mechanic read/write boundaries, and RLS. Session authentication is not a substitute for operation authorization.
- **NFR2 — Error handling:** Keep `withAuth` for actions and login redirects for expired sessions; recoverable failures return discriminated results, reads return data plus `error`, and failures are logged with context and surfaced clearly.
- **NFR3 — Data ownership:** PostgreSQL owns business calculations, cross-table reporting, and atomic/versioned workflow decisions. The UI owns presentation and unsent drafts.
- **NFR4 — Migration safety:** New DDL is idempotent, policies/triggers use drop-then-create, and application occurs only on a local/disposable database during development. Hosted deployment remains through merge/CI.
- **NFR5 — Reuse:** Search before creating clients, components, helpers, or test infrastructure. Preserve the existing Next.js/Supabase/Subframe stack.
- **NFR6 — Behavior preservation:** Preserve role permissions, explicit-submit search, Workshop tablet controls, workflow versions/leases, and the app-authoritative, non-blocking printing workflow.
- **NFR7 — Independent delivery:** Each story is self-contained, can deliver value without another story landing first, and owns its necessary implementation tests. Coordination is documented without inventing hard dependencies.
- **NFR8 — Evidence:** Revalidate code and baseline checks at pickup. Historical audit counts and hypotheses are not acceptance evidence. Use actual runtime/database behavior where the requirement depends on it.

### Additional Requirements

- Retain the existing authenticated user Supabase clients; never use the service-role key to bypass user-facing RLS.
- Retain Workshop's module boundaries, transactional commands, expected-version checks, source completeness, token/fence leases, and environment isolation.
- Add forward migrations rather than rewriting already-deployed migration history. Clean bootstrap and rerunning a new migration are separate checks.
- Do not infer numeric request budgets, commission/rounding policies, or a new signup role from this review. Relevant stories record decisions to resolve before dependent implementation.
- Existing shared-search work is input to Story 1.1. Recheck its latest state and preserve user-owned changes.
- No greenfield starter template, platform replacement, background queue, or live third-party mutation is required to record or independently verify this epic.

### UX Design Requirements

- **UX-DR1:** Preserve list controls, focus, draft text, filters, and unrelated URL parameters during navigation; expose pending state at the results table.
- **UX-DR2:** Save feedback distinguishes pending/unsaved, saved, failed, and conflicting edits; retry never discards the latest draft.
- **UX-DR3:** Search, pagination, save feedback, and role navigation remain usable with keyboard input and existing desktop/mobile/tablet layouts.

### FR Coverage Map

| Review recommendation | Requirement | Epic / Story | Priority |
| --- | --- | --- | --- |
| FE-1 — Complete list interaction pattern | FR1 | 1 / 1.1 | Normal |
| FE-2 — Reliable save lifecycle | FR2 | 1 / 1.2 | High |
| FE-3 — Frontend quality gate | FR3 | 1 / 1.3 | High |
| DB-1 — Trusted role assignment | FR4 | 1 / 1.4 | Urgent |
| DB-2 — Reproducible database and migration checks | FR5 | 1 / 1.5 | High |
| DB-3 — SQL reporting source of truth | FR6 | 1 / 1.6 | High |
| API-1 — Authorize external side effects | FR7 | 1 / 1.7 | Urgent |
| API-2 — Typed and validated boundaries | FR8 | 1 / 1.8 | High |
| API-3 — Bounded external requests and independent outcomes | FR9 | 1 / 1.9 | High |

## Epic List

### Epic 1: Reliable Project Foundations for Continued Growth

Staff and partners can rely on consistent interactions, preserved edits, accurate complete reports, and enforced permissions as the application grows. Developers can safely reuse shared patterns, recreate the local environment, and catch violations before deployment.

**FRs covered:** FR1–FR9. **Status:** Backlog. **Stories:** Exactly nine, preserving the review order.

The cross-cutting user outcome is dependable operations during rapid growth. The three review dimensions organize traceability inside one epic; they are not separate epics.

## Epic 1: Reliable Project Foundations for Continued Growth

### Delivery contract

- Each story is a complete outcome and has **no hard dependency on another story**. It can be refined and implemented in a separate session using its own file.
- Independence does not mean edits cannot overlap. Story 1.3 owns application CI and browser-test infrastructure; Story 1.5 owns database CI and fixtures. Every story owns its relevant regression tests and migrations even if those shared gates do not exist yet.
- Story 1.8 introduces generated types. Any later schema-changing story regenerates them if already present; no story requires that introduction first.
- Story 1.4 repairs account-role provisioning. Story 1.7 repairs operation authorization. Both are necessary security improvements, but either can land independently.
- Scope-changing product decisions are listed in the affected story. Recording the backlog does not claim they have been resolved or that implementation has started.
- Suggested order: **1.4 and 1.7 first**, then 1.3/1.5, then the other stories according to availability and current pain. This order is advisory.

### Epic completion

All nine stories meet their acceptance criteria on the then-current branch, applicable product decisions are recorded, checks run at the behavior-owning boundary, and the relevant tests are integrated into CI. Current project behavior and role permissions are retained except for the explicitly intended corrections.

### Independent-session workflow

Open a story file, read its evidence and constraints, revalidate the finding against the current branch, resolve only its listed decisions, and refine the implementation plan in that session. Use the existing BMad implementation workflow when ready. Record changed files, tests and outcomes in the story's completion record, then update its status in the index. No prior conversation is required.

### Story index

The linked standalone files are the canonical execution handoffs. The excerpts below preserve the BMad epic format; update an excerpt if its story criteria change. Every story includes its own evidence, scope, constraints, verification, decisions, and completion record.

| Story | Review | Standalone handoff | Priority | Status |
| --- | --- | --- | --- | --- |
| 1.1 | FE-1 | [Consistent list interactions](stories/project-foundations/1-1-consistent-list-interactions.md) | Normal | Backlog |
| 1.2 | FE-2 | [Reliable save lifecycle](stories/project-foundations/1-2-reliable-save-lifecycle.md) | High | Backlog |
| 1.3 | FE-3 | [Dependable frontend quality gate](stories/project-foundations/1-3-frontend-quality-gate.md) | High | Backlog |
| 1.4 | DB-1 | [Trusted account role assignment](stories/project-foundations/1-4-trusted-role-assignment.md) | Urgent | Done |
| 1.5 | DB-2 | [Reproducible database and migration gate](stories/project-foundations/1-5-reproducible-database-and-migration-gate.md) | High | Backlog |
| 1.6 | DB-3 | [Canonical SQL reporting and complete exports](stories/project-foundations/1-6-canonical-sql-reporting.md) | High | Backlog |
| 1.7 | API-1 | [Authorize external side effects](stories/project-foundations/1-7-authorized-external-side-effects.md) | Urgent | Backlog |
| 1.8 | API-2 | [Typed and validated data boundaries](stories/project-foundations/1-8-typed-validated-data-boundaries.md) | High | Backlog |
| 1.9 | API-3 | [Bounded external requests and independent sync outcomes](stories/project-foundations/1-9-bounded-external-requests.md) | High | Backlog |

### Story 1.1: Consistent list interactions

**Standalone story:** [1-1-consistent-list-interactions.md](stories/project-foundations/1-1-consistent-list-interactions.md)  
**Review:** FE-1 · **Priority:** Normal · **Status:** Backlog

As a staff member moving between operational lists,
I want search, filters, pagination, history, and loading feedback to behave consistently,
So that I can navigate confidently without losing my draft or page context.

**Acceptance Criteria:**

**AC1 — Applied query and pagination**

**Given** a scoped list with filters and an unsent search draft, **When** the user submits Search or Enter, **Then** the trimmed submitted query becomes URL state, pagination resets to page 1, and current filters and relevant unrelated parameters survive; **And** changing a filter or page uses the applied query without silently submitting the draft.

**AC2 — Localized pending feedback**

**Given** any scoped search, filter, or pagination navigation, **When** results are delayed, **Then** the results area exposes an accessible pending state while controls, draft text, and focus remain stable; **And** success, empty results, and failure end pending state correctly.

**AC3 — History and refresh**

**Given** applied navigation history or a newer unsent draft, **When** Back/Forward, explicit clear, or realtime refresh occurs, **Then** the shared contract distinguishes history/reset from acknowledgement/refresh and displays the correct applied URL state without an older response erasing a newer draft.

**AC4 — Existing workflow guards**

**Given** Workshop sync or tablet mode is active, **When** list controls are used, **Then** current sync blocking and tablet sizing are preserved; **And** navigation pending remains separate from synchronization pending.

**AC5 — Reuse and accessibility**

**Given** all seven scoped components, **When** their list behavior is inspected and exercised, **Then** they use the shared contract with page-specific configuration rather than copied navigation lifecycle logic; **And** keyboard submission, IME composition, pagination, and mobile/tablet layouts remain usable.

**AC6 — Failure and session boundaries**

**Given** a loader error or expired session during navigation, **When** the request resolves, **Then** the established error banner or login boundary is shown, controls recover, and failed data is not presented as a successful empty result.

### Story 1.2: Reliable save lifecycle

**Standalone story:** [1-2-reliable-save-lifecycle.md](stories/project-foundations/1-2-reliable-save-lifecycle.md)  
**Review:** FE-2 · **Priority:** High · **Status:** Backlog

As a staff member editing a bike fit or Wiki document,
I want reliable autosave and clear conflict/failure feedback,
So that my latest work is preserved and I know what has actually been saved.

**Acceptance Criteria:**

**AC1 — Serial writes and latest draft**

**Given** edits continue while a save is in flight, **When** the pending operation finishes, **Then** the next save uses the appropriate latest draft and returned version in order; **And** stale acknowledgements cannot mark newer unsaved content as saved or replace it in the editor.

**AC2 — Concurrent editing**

**Given** two editing sessions loaded the same record version, **When** one saves and the other attempts a write based on that old version, **Then** the database atomically rejects the stale write, the second editor retains its draft, and a clear conflict/recovery path is shown without silent overwrite.

**AC3 — Failure and retry**

**Given** a recoverable save failure, **When** the user retries, **Then** the latest intended content is retried safely, failure feedback is visible, and subsequent edits are still possible; **And** an expired session follows the existing `withAuth` login boundary rather than appearing as a normal save error.

**AC4 — Completion and publishing**

**Given** an autosave is pending, **When** a user completes a bike fit or publishes a document, **Then** the final operation coordinates with pending saves and validates the latest intended content; **And** a late draft write cannot undo completion/publishing or overwrite the final content.

**AC5 — Lifecycle and accessible feedback**

**Given** unsaved or in-flight edits, **When** the editor changes record, unmounts, or the user navigates away, **Then** the agreed flush/warning behavior prevents silently losing work; **And** idle/unsaved/saving/saved/error/conflict states reflect actual persistence and are accessible to keyboard and assistive-technology users.

**AC6 — Adoption and regression safety**

**Given** both editors and the existing Workshop flow, **When** verification runs, **Then** Bike Fit and Wiki use the shared lifecycle, version checks are enforced through authenticated writes, and Workshop command ordering, stage guards, and printing behavior remain intact.

### Story 1.3: Dependable frontend quality gate

**Standalone story:** [1-3-frontend-quality-gate.md](stories/project-foundations/1-3-frontend-quality-gate.md)  
**Review:** FE-3 · **Priority:** High · **Status:** Backlog

As a developer extending the portal,
I want a passing and enforced application-quality gate with real browser coverage,
So that reuse of existing components does not spread regressions into new features.

**Acceptance Criteria:**

**AC1 — Clean, meaningful lint baseline**

**Given** a fresh installation on the supported project runtime, **When** the documented lint command runs, **Then** it exits successfully with zero errors and substantive warnings are addressed or explicitly justified; **And** broad rule disabling or hiding application code from lint is not used to manufacture a pass.

**AC2 — Actual list behavior**

**Given** a browser running against isolated test data, **When** a user submits search, changes filters/pages, and uses Back/Forward with delayed results, **Then** assertions inspect the rendered UI and resulting URL state, including retention of a newer draft.

**AC3 — Actual saves and permission navigation**

**Given** isolated users for supported roles and an editor record, **When** the browser performs a successful save, a recoverable failed save, an expired-session action, and allowed/forbidden navigation, **Then** the expected persistence, feedback, and auth boundaries are verified through real application paths.

**AC4 — Required CI checks**

**Given** a pull request introducing a lint/type failure or a covered runtime regression, **When** CI runs, **Then** the relevant check fails and the merge gate requires it; **And** a passing change runs all documented application checks without depending on an unrelated foundation story.

**AC5 — Isolated and reproducible execution**

**Given** a clean local or CI environment, **When** the suite runs, **Then** setup uses synthetic users/data and local or disposable services, outbound vendor effects are mocked/disabled, failures include useful diagnostics, and no staging/production credentials are required.

**AC6 — Coverage is maintained**

**Given** existing source-structure and domain tests, **When** the gate is introduced, **Then** useful architectural assertions remain while runtime tests cover the named user behaviors; **And** test commands, check names, setup, and debugging instructions are documented for the next developer.

### Story 1.4: Trusted account role assignment

**Standalone story:** [1-4-trusted-role-assignment.md](stories/project-foundations/1-4-trusted-role-assignment.md)  
**Review:** DB-1 · **Priority:** Urgent · **Status:** Done

As an administrator responsible for portal access,
I want account roles assigned only by a trusted provisioning path,
So that a new user cannot obtain staff or admin access by supplying their own role metadata.

**Acceptance Criteria:**

**AC1 — Caller metadata cannot elevate privileges**

**Given** account creation with caller-controlled metadata requesting `admin`, `manager`, `mechanic`, or another role, **When** the profile is provisioned, **Then** those values cannot grant access; **And** the account receives only the approved safe/default state unless a trusted assignment exists.

**AC2 — Missing and malformed metadata**

**Given** missing, malformed, or unsupported role metadata, **When** account creation runs, **Then** the approved safe path is used or a clear controlled failure occurs, without an unsafe role fallback or an unhandled enum-cast failure.

**AC3 — Trusted provisioning remains usable**

**Given** an authorized provisioning operation selecting a supported role, **When** the account is created or activated through that path, **Then** it receives exactly the authorized role and intended associations; **And** the same assignment cannot be reproduced through ordinary user metadata or a low-privilege request.

**AC4 — Existing users and metadata updates**

**Given** existing admin, manager, mechanic, and partner profiles, **When** the migration runs or those users change non-security metadata, **Then** their legitimate assignments remain unchanged; **And** metadata updates cannot change `profiles.role` through another route or trigger.

**AC5 — End-to-end denial**

**Given** a newly created untrusted account, **When** it calls protected routes, actions, or RLS-backed reads/writes directly, **Then** the approved access boundary is enforced beyond the navigation UI; **And** legitimate role fixtures retain their established permissions.

**AC6 — Safe migration and deployment**

**Given** an existing database or fresh local stack, **When** the new forward migration is applied and reapplied locally, **Then** provisioning and role checks are correct and repeatable; **And** hosted changes are delivered only through the existing merge/CI path.

### Story 1.5: Reproducible database and migration gate

**Standalone story:** [1-5-reproducible-database-and-migration-gate.md](stories/project-foundations/1-5-reproducible-database-and-migration-gate.md)  
**Review:** DB-2 · **Priority:** High · **Status:** Backlog

As a developer or operator preparing a release,
I want required database/storage setup to be reproducible and migrations verified before deployment,
So that a fresh environment works and schema changes fail early instead of during a hosted release.

**Acceptance Criteria:**

**AC1 — Required setup without sample seed**

**Given** an empty disposable database with optional sample seeding disabled, **When** all repository migrations run, **Then** required schemas, functions, grants/policies, configuration rows, and storage buckets exist; **And** representative authorized storage/database operations work without importing exported business records.

**AC2 — Synthetic local development data**

**Given** the documented local fixture setup, **When** it runs, **Then** developers obtain the required synthetic role and feature scenarios without copied customer records, recovery/session material, or production credentials; **And** storage examples are either actual synthetic files or explicitly absent, not dangling metadata presented as working uploads.

**AC3 — Fresh and upgrade paths**

**Given** both a clean database and a disposable database at the prior migration baseline, **When** the branch migrations are applied, **Then** both reach the same intended schema and pass the applicable SQL contracts, with representative existing data preserved on the upgrade path.

**AC4 — New-migration reapplication**

**Given** each new migration in the change under test, **When** its SQL is reapplied in an isolated database, **Then** it succeeds without duplicate policy/constraint/trigger failures or duplicate configuration data; **And** the method does not rewrite hosted history or blindly replay the entire historical dump against a populated schema.

**AC5 — SQL behavior tests are enforced**

**Given** the database validation job, **When** pgTAP detects a schema, RLS, command, or replay regression, **Then** CI fails and the deployment workflow cannot proceed; **And** a passing branch runs the existing suites plus the required setup/migration regressions.

**AC6 — Safe deployment sequencing**

**Given** staging or main receives a change, **When** its deployment executes, **Then** database validation succeeds before the hosted push, the intended environment is selected, and any failed prerequisite prevents that push; **And** PR validation requires no hosted database secrets.

**AC7 — Developer operating instructions**

**Given** a fresh checkout and documented prerequisites, **When** a developer follows the database setup/verification guide, **Then** the commands are reproducible and clearly distinguish disposable reset, optional fixtures, migration validation, and merge/CI deployment.

### Story 1.6: Canonical SQL reporting and complete exports

**Standalone story:** [1-6-canonical-sql-reporting.md](stories/project-foundations/1-6-canonical-sql-reporting.md)  
**Review:** DB-3 · **Priority:** High · **Status:** Backlog

As a partner or staff member checking performance and commission reports,
I want the dashboard and downloaded report to use the same financial rules and complete data,
So that totals reconcile and growth does not silently omit orders from exports.

**Acceptance Criteria:**

**AC1 — Rules are explicit**

**Given** the current data and business expectations, **When** the reporting contract is approved for implementation, **Then** it specifies the canonical rate representation, included statuses, date field/time zone/boundaries, rounding level, and tax calculations with concrete fixtures; **And** ambiguity is not resolved through undocumented heuristics.

**AC2 — One calculation owner**

**Given** identical partner and timeframe inputs, **When** dashboard and CSV are generated, **Then** PostgreSQL supplies their business totals/commissions using the same rules, both agree on counts and monetary results, and UI/API JavaScript only formats the outputs rather than independently recomputing business aggregates.

**AC3 — Complete export beyond the API cap**

**Given** an authorized result set larger than the configured single-request row cap, **When** export runs, **Then** every eligible row is retrieved exactly once with deterministic ordering and bounded pages; **And** exported rows reconcile with the report totals under the documented consistency model.

**AC4 — Edge cases and rounding**

**Given** empty periods, boundary dates, small/fractional commissions, zero values, and every supported order status, **When** reporting runs, **Then** SQL test fixtures demonstrate the approved inclusion and rounding rules and produce consistent daily, line, and overall values.

**AC5 — Access control**

**Given** a partner, another partner, a mechanic, and authorized staff, **When** they request reports or call the underlying views/RPCs directly, **Then** the existing approved reporting permissions and partner isolation are enforced without a service-role bypass.

**AC6 — Failure and concurrency semantics**

**Given** an export page fails or source data changes during pagination, **When** the operation completes, **Then** the approved snapshot/cutoff/retry behavior is honored, partial data is not presented as a complete report, and a recoverable error is surfaced when consistency cannot be met.

### Story 1.7: Authorize external side effects

**Standalone story:** [1-7-authorized-external-side-effects.md](stories/project-foundations/1-7-authorized-external-side-effects.md)  
**Review:** API-1 · **Priority:** Urgent · **Status:** Backlog

As an administrator managing marketing links,
I want external mutations to enforce the same operation permissions as the application,
So that a signed-in user with read-only access cannot create or delete Short.io links.

**Acceptance Criteria:**

**AC1 — Denial before external calls**

**Given** an unauthenticated, partner, or mechanic caller, **When** they directly invoke Short.io creation or deletion, **Then** no Short.io request is made, no local row changes, and the appropriate login/401/403 or forbidden action result is returned.

**AC2 — Partner read permission is preserved**

**Given** a partner can read a marketing link assigned to them, **When** they use that link's identifier to call deletion, **Then** operation authorization denies the call before the vendor request; **And** legitimate read-only access remains unchanged.

**AC3 — Authorized behavior**

**Given** an admin or manager and valid inputs, **When** creation or deletion runs, **Then** the existing assignment, deduplication, and successful UI behavior remains available and current role authorization has been checked before the side effect.

**AC4 — Mutation outcomes are real**

**Given** a missing, concurrently removed, or RLS-inaccessible row, **When** the database mutation returns no affected row, **Then** the operation does not report a misleading successful mutation; **And** the caller receives the agreed not-found/already-removed/forbidden outcome.

**AC5 — Partial external/database failure**

**Given** Short.io succeeds but persistence fails, or the vendor fails before persistence, **When** the result is returned, **Then** it accurately describes the partial/failure state, preserves enough information for the existing safe recovery path, and a retry does not silently create duplicates or claim unverified success.

**AC6 — Permission-check failures fail closed**

**Given** the role lookup fails or the session expires, **When** the operation is attempted, **Then** no vendor request executes; **And** actions retain the `withAuth` session redirect while fetch-called routes return structured HTTP errors.

### Story 1.8: Typed and validated data boundaries

**Standalone story:** [1-8-typed-validated-data-boundaries.md](stories/project-foundations/1-8-typed-validated-data-boundaries.md)  
**Review:** API-2 · **Priority:** High · **Status:** Backlog

As a developer reusing database loaders and API actions,
I want schema-derived database types and validated boundary inputs,
So that schema drift and malformed requests fail predictably instead of becoming runtime surprises.

**Acceptance Criteria:**

**AC1 — Reproducible type generation**

**Given** a locally migrated database, **When** the documented generation command runs, **Then** committed generated types accurately represent the used tables, views, enums, and RPC signatures; **And** running it again without schema changes produces no unexplained diff.

**AC2 — Typed clients and query safety**

**Given** any browser/server/backend Supabase factory, **When** it is used by application queries, **Then** it carries the generated schema type, invalid typed table/column/RPC arguments are detected where supported, and remaining dynamic/JSON exceptions have explicit narrow validation/mapping rather than broad `any` or `as unknown as` escapes.

**AC3 — Runtime input validation**

**Given** malformed JSON, null/array bodies, wrong field types, unsupported enums, or invalid identifiers at a callable boundary, **When** the request/action executes, **Then** it returns the established recoverable validation response before database/vendor mutation and does not crash on unchecked destructuring or method calls.

**AC4 — Existing valid behavior**

**Given** valid current payloads and records, **When** loaders, actions, and routes run, **Then** current response shapes, nullable values, pagination, and user-visible behavior remain correct; **And** presentation/domain DTOs remain separate where they intentionally differ from persisted rows.

**AC5 — Schema drift is detectable**

**Given** a migration changes a used table/view/RPC contract, **When** local verification or the available CI check runs without updating generated types and affected callers, **Then** it fails with actionable evidence; **And** the documented workflow regenerates types and checks consumers after schema changes.

**AC6 — Boundary protections are preserved**

**Given** invalid input, missing sessions, denied roles, or failed reads, **When** typed/validated code handles them, **Then** `withAuth`, RLS, context-prefixed errors, and data-plus-error loader results remain intact; **And** validation does not expose secrets or use service-role clients to bypass denial.

### Story 1.9: Bounded external requests and independent sync outcomes

**Standalone story:** [1-9-bounded-external-requests.md](stories/project-foundations/1-9-bounded-external-requests.md)  
**Review:** API-3 · **Priority:** High · **Status:** Backlog

As an operator relying on external customer and order integrations,
I want requests to finish within known bounds and each destination's outcome to be recorded,
So that a slow or failed provider does not hide successful work or leave synchronization in an ambiguous state.

**Acceptance Criteria:**

**AC1 — Bounded requests**

**Given** a provider stalls during connection, headers, or body reading, **When** its request exceeds the documented deadline, **Then** the operation settles with a meaningful timeout result and cleanup; **And** the enclosing request remains within its documented total execution budget.

**AC2 — Bounded and appropriate retries**

**Given** a retryable network error, 429, or eligible 5xx response, **When** an operation is safe to retry, **Then** attempts and backoff remain within the total budget, jitter is applied where appropriate, and valid `Retry-After` is honored only within that budget; **And** permanent failures terminate without retry loops.

**AC3 — Side-effect safety**

**Given** a timeout or ambiguous outcome for a create/update/delete operation, **When** recovery is considered, **Then** the adapter uses its established idempotency/reconciliation contract or surfaces uncertainty rather than blindly repeating an unsafe operation or declaring success.

**AC4 — Independent destination persistence**

**Given** one customer destination succeeds, another fails, and a third is slow, **When** each result becomes known, **Then** that destination's ID/status/error is persisted independently and remains visible even while another destination is pending; **And** timeout/failure of the slow destination does not erase successful outcomes.

**AC5 — Concurrency and persistence failures**

**Given** overlapping customer events or a database failure while saving a destination outcome, **When** handlers finish, **Then** stale/partial writes cannot replace newer or other-destination state, persistence failures are visible, and the agreed webhook retry/acknowledgement semantics preserve recoverability.

**AC6 — Existing order-sync invariants**

**Given** Booqable order synchronization, **When** requests retry, time out, or return incomplete/invalid pages, **Then** no partial source snapshot is applied, lease/token/fence safeguards remain effective, and manual-sync cursor/progress/environment guards remain correct.

**AC7 — Consistent adoption and diagnosability**

**Given** every scoped provider path, **When** success, timeout, permanent error, retry exhaustion, or malformed response is tested, **Then** the shared transport contract is used where applicable, adapter-specific meaning is retained, and logs/UI expose actionable context without credentials or raw sensitive payloads.

## Backlog validation — 2026-09-15

- **Structure:** One epic, nine standalone stories, and one preserved source review. No recommendation was dropped, merged with another story, or expanded into an extra story.
- **Functional coverage:** FR1–FR9 map one-to-one to Stories 1.1–1.9, with 56 Given/When/Then acceptance criteria. Epic excerpts match the canonical story files.
- **Nonfunctional coverage:** Authorization and errors are explicit in all applicable stories, especially 1.4/1.7/1.8; SQL ownership in 1.2/1.6; migration safety in 1.2/1.4/1.5/1.6/1.9; reuse, independent delivery, and current-evidence verification are included throughout.
- **UX coverage:** UX-DR1 is covered by 1.1; UX-DR2 by 1.2; UX-DR3 by 1.1/1.2/1.3. Other stories preserve established interface behavior.
- **Architecture:** Existing stack and module/security boundaries retained; no starter project or universal upfront schema setup. Each story owns only its needed schema/test changes. No new background queue is implied.
- **Independence:** No hard story dependencies. Shared file/CI/type-generation ownership and adoption order are documented. Suggested security-first ordering is advisory.
- **Document checks:** Local Markdown links and anchors resolve, all standalone sections are present, numbering is consistent, and no template placeholders remain.
- **Readiness:** Complete for the user's requested backlog-recording purpose. The one-to-one scope is user-selected; detailed acceptance criteria are proposed for future refinement, not a claim of separate implementation approval. Decisions flagged in each story must be resolved before dependent coding.
- **Verification boundary:** This recording task changed documentation only. The original review's test/lint numbers remain a dated snapshot and were not rerun as implementation validation.
