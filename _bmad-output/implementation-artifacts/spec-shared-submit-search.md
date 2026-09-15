---
title: 'Shared search with explicit submission'
type: 'bugfix'
created: '2026-09-14'
status: 'done'
baseline_commit: '10fbda3410d5b2dff2c2e1af8ffaac3628f6707c'
approved: '2026-09-15'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** List searches duplicate a 300 ms debounce and copy incoming URL queries into the input. A completed navigation can overwrite characters entered since that search started.

**Approach:** Reuse one search component across Workshop, Orders, Customers, Bike Fits listing, Wiki home/directories, and HQ Marketing Links. Apply searches only through a visible Search button or Enter, keeping newer draft text safe when results arrive.

## Boundaries & Constraints

**Always:** Reuse Subframe TextField and Button. Keep applied search, filters, and pagination in the URL; local state represents only an unsubmitted draft. Preserve page-specific placeholders, filter semantics, access rules, loading/error states, and Workshop tablet sizing and sync guards. Trim submitted queries and reset pagination to page 1. Filters and pagination use the applied query, never silently submit a draft.

**Ask First:** Expanding to entity pickers, changing matching rules, or requiring backend contracts to change.

**Never:** Automatic search timers here, client-side filtering, database changes, or changes to partner listings, autosave, and Bike Fit customer autocomplete.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Draft | Type or paste, then pause | Text remains; URL/results stay unchanged | Existing result errors remain visible |
| Submit | Click Search or press Enter | Submit current trimmed draft; preserve filters; reset page | Existing route error handling |
| Late result | Submit `abc`, then type `abcdef` before completion | Results apply `abc`; input stays `abcdef` until another explicit submission | No rollback of draft |
| Repeated submission | Submit A, then edit and submit B while A loads | Final applied query is B; intermediate completion cannot erase newer text | No duplicate push for the same pending query |
| Empty | Delete text or use native input clear, then submit | Remove query; page 1; preserve filters | No validation error |
| Refresh/filter | Unsubmitted draft exists; refresh or change another filter/page | Preserve draft; other controls use applied query | Preserve existing loading/errors |
| History/reset | Back/Forward or Wiki Clear search | History restores destination query; explicit Wiki clear resets draft and applied query | Do not mistake history for submission acknowledgement |
| Keyboard/sync | IME composition or Workshop sync blocks navigation | Composition Enter does not submit; blocked submit does not queue a later search | Honor existing sync feedback |

</frozen-after-approval>

## Code Map

- `src/ui/components/TextField.tsx`, `src/ui/components/Button.tsx` — reusable primitives; Button needs `type="submit"`.
- `src/app/workshop/_components/WorkshopQueue.tsx` — `pushQueue`, `syncInFlight`, table-local pending state, tablet classes, and realtime refresh.
- `src/app/orders/_components/AllOrdersTable.tsx` — `buildHref` preserves timeframe; realtime refresh.
- `src/app/customers/_components/CustomersLandingTable.tsx` — `buildHref` clones URL parameters; customer drawer and table transition.
- `src/app/bike-fits/all-bike-fits/_components/AllBikeFitsTable.tsx` — timeframe navigation.
- `src/app/wiki/_components/WikiHome.tsx`, `src/app/wiki/_components/WikiDirectory.tsx` — global/category searches, clear action, status filters, pagination.
- `src/app/hq/links/_components/MarketingLinksTable.tsx` — assignment filter.
- `src/workshop-ui.test.mts`, `src/customers-landing-status.test.mts` — existing navigation assertions reference old search wiring; Node test runner available.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/SearchField.tsx` — accessible form, draft ownership, submission, reset/history handling; callers build URLs.
- [x] `src/components/search-field-state.ts` — testable draft/submission reconciliation without overwriting newer edits.
- [x] Seven listing components in Code Map — replace duplicated search state/effects with SearchField; retain URL builders and existing navigation transitions. Wire Wiki clear and Workshop sizing/sync behavior.
- [x] `src/search-field.test.mts` — unit-test matrix transitions using actual shared logic.
- [x] `src/workshop-ui.test.mts`, `src/customers-landing-status.test.mts` — update obsolete search wiring assertions without weakening navigation/loading coverage.

**Acceptance Criteria:**
- Given any scoped listing, when text is edited without submitting, then no search navigation starts regardless of elapsed time.
- Given any scoped listing with active filters, when Search or Enter submits, then URL-driven results use the submitted query on page 1 with those filters preserved.
- Given a delayed search navigation, when newer edits occur before completion, then the displayed draft and focus survive completion.
- Given desktop, mobile, or Workshop tablet layout, when the shared control renders, then its input and labeled Search button remain usable without overflow.

## Spec Change Log

## Design Notes

Track submissions explicitly; distinguish acknowledgements from history/reset. Never key the component by query or hide the input during ordinary navigation.

## Session Handoff

Approved on 2026-09-15. The user explicitly deferred implementation to a new session. No application code has been changed; all execution tasks remain pending. Resume this spec with `bmad-build` at the implementation step. Preserve the approved intent block.

## Verification

**Commands:**
- `node --test src/search-field.test.mts` — behavioral regressions pass.
- `npm run test:workshop-ui` and `npm run test:customers-landing-status` — existing relevant regressions pass.
- `npx tsc --noEmit` and ESLint on changed source/test files — no introduced type/lint errors.

**Browser checks:**
- Exercise all seven surfaces with Search, Enter, empty search, filters, pagination, and Back/Forward. Throttle navigation and type after submission; check successive submissions, focus, and Wiki clear. Check mobile/tablet sizing and Workshop sync guard. Record unavailable authenticated checks explicitly.

## Suggested Review Order

**Shared search state**

- Owns drafts separately from URL state and recognizes acknowledgements versus history.
  [`search-field-state.ts:34`](../../src/components/search-field-state.ts#L34)

- Binds guarded form submission and preserves focus through URL-driven result updates.
  [`SearchField.tsx:26`](../../src/components/SearchField.tsx#L26)

**Listing integration**

- Keeps Workshop’s sync guard, tablet sizing, filters, and table-local transition intact.
  [`WorkshopQueue.tsx:202`](../../src/app/workshop/_components/WorkshopQueue.tsx#L202)

- Demonstrates URL builders preserving each surface’s existing filter and pagination semantics.
  [`CustomersLandingTable.tsx:29`](../../src/app/customers/_components/CustomersLandingTable.tsx#L29)

- Clears Wiki search explicitly while the shared field reconciles the destination URL.
  [`WikiHome.tsx:91`](../../src/app/wiki/_components/WikiHome.tsx#L91)

**Regression coverage**

- Exercises draft, submission, race, reset, history, IME, and blocked-navigation transitions.
  [`search-field.test.mts:10`](../../src/search-field.test.mts#L10)

- Retains existing Workshop navigation and customer transition coverage after the migration.
  [`workshop-ui.test.mts:844`](../../src/workshop-ui.test.mts#L844)
