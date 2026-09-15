---
title: Reliable save lifecycle
story_id: '1.2'
epic_id: '1'
review_recommendation: FE-2
requirements: [FR2, UX-DR2, UX-DR3]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.2: Reliable save lifecycle

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review FE-2](../../reviews/project-foundations-review-2026-09-15.md#fe-2--create-a-reusable-reliable-save-lifecycle)

## User story

As a staff member editing a bike fit or Wiki document,
I want reliable autosave and clear conflict/failure feedback,
So that my latest work is preserved and I know what has actually been saved.

## Review context and evidence

Both editors have debounced effects with `cancelled` flags. Cleanup suppresses stale UI responses, not database writes. Their server updates have no expected-record-version condition. The review did not reproduce a browser race; delayed requests and concurrent editors must be tested rather than assumed. Workshop already serializes item commands and checks versions, but that orchestration is embedded in a large UI component.

Entry points:

- `src/app/bike-fits/_components/BikeFitWizard.tsx`: autosave, finalization, save feedback.
- `src/lib/bike-fit/actions/bike-fit-actions.ts`: `saveBikeFitDraft`, `completeBikeFit`, unlock flow.
- `src/app/wiki/_components/WikiEditor.tsx`, `src/lib/wiki/actions/wiki-actions.ts`: document autosave/update.
- `src/hooks/use-debounced-value.ts`.
- `src/app/workshop/_components/WorkshopTask.tsx`: `enqueueItemCommand`, task version and stale-command handling.
- `supabase/migrations/`: current `bike_fits`, `wiki_documents`, and Workshop version contracts.

## Scope

- Adopt one reusable save lifecycle in Bike Fit and Wiki: serialized writes, latest draft retention, explicit states, retry handling, and conflict feedback.
- Enforce optimistic concurrency at the database write boundary for those records, with a version or equivalent atomic comparison; client-side cancellation alone is insufficient.
- Use Workshop as an existing design reference. Extract only directly reusable lifecycle concerns; do not rewrite its state machine or transplant Workshop-specific stages into document editors.
- Preserve existing validation, draft/completion/publish rules, report invalidation, and role permissions. Exclude offline editing, collaborative merging, and a general document-history product.

## Acceptance criteria

### AC1 — Serial writes and latest draft

**Given** edits continue while a save is in flight, **When** the pending operation finishes, **Then** the next save uses the appropriate latest draft and returned version in order; **And** stale acknowledgements cannot mark newer unsaved content as saved or replace it in the editor.

### AC2 — Concurrent editing

**Given** two editing sessions loaded the same record version, **When** one saves and the other attempts a write based on that old version, **Then** the database atomically rejects the stale write, the second editor retains its draft, and a clear conflict/recovery path is shown without silent overwrite.

### AC3 — Failure and retry

**Given** a recoverable save failure, **When** the user retries, **Then** the latest intended content is retried safely, failure feedback is visible, and subsequent edits are still possible; **And** an expired session follows the existing `withAuth` login boundary rather than appearing as a normal save error.

### AC4 — Completion and publishing

**Given** an autosave is pending, **When** a user completes a bike fit or publishes a document, **Then** the final operation coordinates with pending saves and validates the latest intended content; **And** a late draft write cannot undo completion/publishing or overwrite the final content.

### AC5 — Lifecycle and accessible feedback

**Given** unsaved or in-flight edits, **When** the editor changes record, unmounts, or the user navigates away, **Then** the agreed flush/warning behavior prevents silently losing work; **And** idle/unsaved/saving/saved/error/conflict states reflect actual persistence and are accessible to keyboard and assistive-technology users.

### AC6 — Adoption and regression safety

**Given** both editors and the existing Workshop flow, **When** verification runs, **Then** Bike Fit and Wiki use the shared lifecycle, version checks are enforced through authenticated writes, and Workshop command ordering, stage guards, and printing behavior remain intact.

## Implementation notes and constraints

Read `AGENTS.md`; keep `withAuth`, discriminated failures, context-prefixed logging, and RLS. Add only the schema changes this story needs, as new idempotent migrations applied locally. Preserve existing completed-fit protections and Wiki slug/publish semantics. Do not automatically overwrite or silently merge a conflicting record. Do not assume that a React effect cleanup aborts a Server Action.

## Verification

- Runtime tests with deferred responses for rapid edits, retry after failure, final-save coordination, and record navigation/unmount.
- Database tests for two writes sharing a version: only the first accepted version wins, and role denials still hold.
- Exercise two editing sessions for one record and verify stored values and visible feedback.
- Run relevant editor/Workshop tests, TypeScript, lint, and migration replay/reapplication checks locally.

## Decisions at pickup

- Confirm the conflict recovery UX and what happens on navigation with unsaved edits before implementing those paths.
- Choose the atomic version representation and the smallest reusable lifecycle abstraction after inspecting current code. Exact debounce intervals are not specified by this review.

## Independence and coordination

No hard dependency. Own the editor changes, necessary migrations, and regression tests. Use current clients and generate types if Story 1.8 has already landed. Story 1.3 may later incorporate these tests into its browser gate; its completion is not a prerequisite.

## Completion record

Implementation has not started in this recording task. At completion record baseline, resolved decisions, changed files, local schema verification, runtime results, residual limitations, and final status; update the epic index.
