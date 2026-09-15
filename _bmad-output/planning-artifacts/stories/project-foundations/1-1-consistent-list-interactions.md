---
title: Consistent list interactions
story_id: '1.1'
epic_id: '1'
review_recommendation: FE-1
requirements: [FR1, UX-DR1, UX-DR3]
status: backlog
priority: normal
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.1: Consistent list interactions

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review FE-1](../../reviews/project-foundations-review-2026-09-15.md#fe-1--standardize-the-complete-list-interaction-pattern)

## User story

As a staff member moving between operational lists,
I want search, filters, pagination, history, and loading feedback to behave consistently,
So that I can navigate confidently without losing my draft or page context.

## Review context and evidence

The review found repeated URL builders and inconsistent pending behavior: Orders directly calls `router.push`, while Workshop owns a navigation transition and a table-local skeleton. Shared search has since been committed at `8d8118c`; additional user changes may exist. This story concerns the remaining complete list interaction pattern, not recreating the search field.

Entry points (repository-relative; locate symbols again at pickup):

- `src/components/SearchField.tsx`, `src/components/search-field-state.ts`, `src/components/TablePagination.tsx`.
- `src/app/workshop/_components/WorkshopQueue.tsx` and its loading skeleton.
- `src/app/orders/_components/AllOrdersTable.tsx`, `src/app/customers/_components/CustomersLandingTable.tsx`.
- `src/app/bike-fits/all-bike-fits/_components/AllBikeFitsTable.tsx`, `src/app/hq/links/_components/MarketingLinksTable.tsx`.
- `src/app/wiki/_components/WikiHome.tsx`, `src/app/wiki/_components/WikiDirectory.tsx`.
- `_bmad-output/implementation-artifacts/spec-shared-submit-search.md` contains the existing search contract.

## Scope

- Establish and adopt a shared navigation/pending contract across the seven staff listing components above, reusing existing primitives and allowing page-specific filters and URL keys.
- Preserve explicit Search/Enter submission, unsubmitted drafts, query reset semantics, and page-specific empty/error states.
- Keep applied search, filters, and pagination in URL parameters. Only unsent drafts and transient interaction state belong in local React state.
- Exclude partner listing behavior, entity pickers, backend matching rules, and visual redesign from this story. Their expansion needs a separately agreed scope.

## Acceptance criteria

### AC1 — Applied query and pagination

**Given** a scoped list with filters and an unsent search draft, **When** the user submits Search or Enter, **Then** the trimmed submitted query becomes URL state, pagination resets to page 1, and current filters and relevant unrelated parameters survive; **And** changing a filter or page uses the applied query without silently submitting the draft.

### AC2 — Localized pending feedback

**Given** any scoped search, filter, or pagination navigation, **When** results are delayed, **Then** the results area exposes an accessible pending state while controls, draft text, and focus remain stable; **And** success, empty results, and failure end pending state correctly.

### AC3 — History and refresh

**Given** applied navigation history or a newer unsent draft, **When** Back/Forward, explicit clear, or realtime refresh occurs, **Then** the shared contract distinguishes history/reset from acknowledgement/refresh and displays the correct applied URL state without an older response erasing a newer draft.

### AC4 — Existing workflow guards

**Given** Workshop sync or tablet mode is active, **When** list controls are used, **Then** current sync blocking and tablet sizing are preserved; **And** navigation pending remains separate from synchronization pending.

### AC5 — Reuse and accessibility

**Given** all seven scoped components, **When** their list behavior is inspected and exercised, **Then** they use the shared contract with page-specific configuration rather than copied navigation lifecycle logic; **And** keyboard submission, IME composition, pagination, and mobile/tablet layouts remain usable.

### AC6 — Failure and session boundaries

**Given** a loader error or expired session during navigation, **When** the request resolves, **Then** the established error banner or login boundary is shown, controls recover, and failed data is not presented as a successful empty result.

## Implementation notes and constraints

Read current `AGENTS.md`. Reuse Subframe controls, server loaders, existing pagination, and shared search. Do not broaden a generic abstraction until differences across the seven lists are mapped. Preserve database filtering, RLS, drawer parameters, scroll behavior, and channel cleanup. This story should not require database changes or a new client-side data cache.

## Verification

- Exercise actual components/navigation for submit, filter, page, Back/Forward, empty query, delayed responses, loader failure, and realtime refresh.
- Include keyboard/IME and Workshop sync/tablet cases, plus a draft typed after submission but before completion.
- Run focused tests, TypeScript, and lint on changed code; record existing unrelated failures separately. Source-text assertions alone do not establish navigation behavior.

## Decisions at pickup

- Audit which behavior is already complete in the shared-search work; credit it and scope only remaining changes.
- Map each page's URL ownership and pending/scroll behavior before selecting a helper/component API. Preserve established product semantics rather than inventing new ones.

## Independence and coordination

No hard dependency. Reuse the current search implementation. Add the story's own runtime regression coverage even if Story 1.3 has not established the general browser gate. Story 1.3 owns central CI wiring; this story owns list behavior. No other story is required to deliver the improvement.

## Completion record

Implementation has not started in this recording task. At completion record the implementation baseline, decisions, changed files, verification results, residual limitations, and final status here; update the epic index.
