# Epic 1 Context: Reliable Project Foundations for Continued Growth

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the foundations reused by the growing portal dependable: staff and partners receive consistent navigation, clear save outcomes, accurate complete reporting, and enforced permissions; developers can safely reproduce the local database, rely on typed and validated boundaries, and catch regressions before release. Preserve current working workflows and role boundaries except where this epic explicitly corrects unsafe behavior.

## Stories

- Story 1.1: Consistent list interactions
- Story 1.2: Reliable save lifecycle
- Story 1.3: Dependable frontend quality gate
- Story 1.4: Trusted account role assignment
- Story 1.5: Reproducible database and migration gate
- Story 1.6: Canonical SQL reporting and complete exports
- Story 1.7: Authorize external side effects
- Story 1.8: Typed and validated data boundaries
- Story 1.9: Bounded external requests and independent sync outcomes

## Requirements & Constraints

- Lists must share URL-driven submitted search, filters, pagination, history, and table-local pending behavior. Preserve draft text, focus, relevant URL parameters, explicit-submit search, accessibility, and existing Workshop sync/tablet behavior.
- Editors need serialized saves, visible pending/saved/failed/conflict states, stale-write protection, and a recovery path that retains the latest draft. Completion or publishing must coordinate with in-flight writes.
- Lint, type, and real browser behavior checks must be reproducible in local/CI environments with synthetic data and no production credentials or outbound vendor effects.
- Account roles must come only from a trusted provisioning operation. Caller-editable signup metadata, missing metadata, malformed values, and later non-security metadata updates must not grant or change privileges; legitimate existing roles and associations remain intact.
- Fresh and upgrade-path local databases must recreate required schema, RLS, storage configuration, and fixtures without exported business data. New migrations must be forward-only, safe to reapply, and verified before hosted deployment through merge/CI.
- PostgreSQL must own shared reporting totals, commissions, inclusion, rounding, and access rules. Dashboard and export must reconcile; exports must obtain every authorized row beyond a one-request cap without representing partial data as complete.
- External mutations require operation-specific authorization before vendor effects, must check database mutation outcomes, and must report partial/ambiguous failures honestly.
- Supabase schema types must be generated from the locally migrated schema; callable inputs require runtime validation before mutations. Preserve valid response shapes, nullable values, RLS, and established error handling.
- External requests require documented bounded deadlines and safe retries. Persist each customer-sync destination result independently, while retaining Booqable complete-snapshot, lease/fence, environment, and manual-sync safeguards.

## Technical Decisions

- Preserve the existing Next.js App Router, React, TypeScript, Supabase/PostgreSQL, and Subframe stack. Search the codebase before creating shared clients, components, helpers, or test infrastructure.
- Use server-side URL search parameters for global list state. PostgreSQL, not UI or Node, owns cross-table calculations, reporting, and atomic/versioned workflow decisions; the UI owns presentation and unsent drafts.
- User-facing reads remain authenticated/RLS-respecting. User-facing actions use the existing `withAuth` boundary and return discriminated recoverable results; loaders return safe fallback data plus an error. Expired sessions redirect to login, recoverable failures are logged with context and surfaced clearly.
- Authorization is separate from authentication. Trust role state from the established database role lookup, not client claims, caller metadata, or service-role bypasses. Direct routes, actions, views, RPCs, storage, and RLS must preserve partner isolation and mechanic boundaries.
- Write idempotent local-only migration files: use drop-then-create for policies and triggers, explicit grants/revokes, safe function search paths, and forward migrations rather than rewritten history. Never apply DDL directly to hosted environments; CI deploys after merge.
- Verify behavior at its owning boundary: browser tests for interaction and auth paths; database/Auth integration or equivalent trigger tests for role provisioning, RLS, migrations, reporting, and concurrency; provider fixtures/mocks for integration behavior. Revalidate the finding and baseline on the current branch rather than treating historic audit counts as acceptance evidence.

## UX & Interaction Patterns

- Navigation feedback belongs in the results area while list controls, draft input, keyboard focus, and layout remain usable. Navigation pending is distinct from Workshop synchronization pending.
- Save states must communicate unsaved, saving, saved, failed, and conflicting edits accurately and accessibly; retry must use the latest intended draft.
- Search, pagination, save feedback, and role navigation must continue to work with keyboard input and existing desktop, mobile, and tablet layouts. Denial must be enforced beyond hidden navigation controls.

## Cross-Story Dependencies

No story has a hard delivery dependency on another. Story 1.3 owns application CI/browser-test infrastructure and Story 1.5 owns database CI/fixtures; each story still supplies its necessary tests if those shared gates are absent. Story 1.8 introduces generated types, and later schema-changing work regenerates them when present. Role-provisioning repair (1.4) and external-side-effect authorization (1.7) are independently deliverable security corrections; security-first ordering is advisory.
