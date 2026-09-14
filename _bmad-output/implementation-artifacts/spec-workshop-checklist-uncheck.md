---
title: 'Allow workshop checklist answers to be cleared'
type: 'bugfix'
created: '2026-09-14'
status: 'done'
baseline_commit: '429593681f291877fb267405fac59a52b35675d5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-automating-mechanics-daily-work/checklist-contract.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-workshop-checklist-keep-clickable.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A mechanic cannot correct a mistaken checklist answer after selecting a checkbox, N/A, or a PSI value.

**Approach:** Until the current checklist stage is submitted, let the mechanic clear any recorded answer. After submission, keep the stage read-only as it is today.

## Boundaries & Constraints

**Always:**
- Clicking a selected checklist checkbox again clears it.
- Clicking a selected N/A option again clears it.
- A saved PSI/value answer has a simple Clear action that removes the saved value and returns the item to incomplete.
- M2 confirmation checkboxes can also be unchecked before M2 is submitted.
- Clearing an answer is saved immediately through the existing item-save queue. The Complete button becomes disabled again while a required item is unanswered.
- If saving fails, show the existing error Alert and restore the last saved answer.
- The existing task status rules remain the submission boundary: M1, M2, and storage answers cannot change after their respective Complete action succeeds.

**Ask First:**
- Changing checklist content, which items allow N/A, or stage-completion rules.

**Never:**
- Change workshop queue, printing, sync, Booqable, add-on, or same-person confirmation behavior.
- Rewrite an existing migration or apply database changes to staging or production.

## I/O & Edge-Case Matrix

| Scenario | Expected behavior |
|----------|-------------------|
| Selected checkbox clicked | Answer clears and item becomes incomplete |
| Selected N/A clicked | N/A clears and item becomes incomplete |
| Saved PSI/value cleared | Saved value clears and item becomes incomplete |
| Confirmed M2 checkbox clicked | Confirmation clears |
| Clear fails to save | Last saved answer returns and the existing error appears |
| Stage already submitted | Server rejects the change and keeps the saved answer |

</frozen-after-approval>

## Code Map

- `src/app/workshop/_components/WorkshopTask.tsx` — make selected checkboxes and N/A controls clickable; add Clear for saved PSI/value answers; preserve the existing optimistic save queue.
- `src/lib/workshop/actions/task-actions.ts` — allow item actions to send an explicit cleared outcome and explicit M2 checked state.
- `supabase/migrations/20260914120000_workshop_checklist_uncheck.sql` — idempotently update the existing guarded commands to accept clear/uncheck values; keep auth, status, version, and grant behavior unchanged.
- `src/workshop-ui.test.mts` — cover checkbox, N/A, PSI/value, and M2 clear wiring while preserving current queue behavior.
- `supabase/tests/database/workshop_foundation.test.sql` — prove cleared values persist, incomplete stages cannot be completed, and submitted stages reject changes.

## Tasks & Acceptance

**Execution:**
- [x] Add the local migration for clearing item outcomes and setting M2 confirmation true or false.
- [x] Update the authenticated actions and workshop task controls.
- [x] Add focused UI and database regression tests.

**Acceptance Criteria:**
- Given an active workshop checklist, when a mechanic clears a checkbox, N/A answer, saved PSI/value, or M2 confirmation, then the answer stays cleared after refresh and the stage cannot be completed until all required answers are valid again.
- Given the stage has been submitted, when an old item command attempts to change an answer, then the server rejects it and leaves the answer unchanged.

## Verification

- `npm run test:workshop-ui`
- `npm run test:db`
- `npx tsc --noEmit`
- `npx eslint src/app/workshop/_components/WorkshopTask.tsx src/lib/workshop/actions/task-actions.ts src/workshop-ui.test.mts`

## Suggested Review Order

**Checklist interaction**

- Entry point: clear outcomes through the existing optimistic save queue.
  [`WorkshopTask.tsx:411`](../../src/app/workshop/_components/WorkshopTask.tsx#L411)

- M1 and storage controls toggle selected answers and expose accessible state.
  [`WorkshopTask.tsx:1066`](../../src/app/workshop/_components/WorkshopTask.tsx#L1066)

- M2 sends the explicit checked state through the same queue.
  [`WorkshopTask.tsx:646`](../../src/app/workshop/_components/WorkshopTask.tsx#L646)

**Persistence boundary**

- Nullable outcomes clear both the answer and any saved PSI value.
  [`20260914120000_workshop_checklist_uncheck.sql:4`](../../supabase/migrations/20260914120000_workshop_checklist_uncheck.sql#L4)

- Explicit M2 confirmation supports both check and uncheck operations.
  [`20260914120000_workshop_checklist_uncheck.sql:85`](../../supabase/migrations/20260914120000_workshop_checklist_uncheck.sql#L85)

- Authenticated actions forward nullable outcomes and checked state unchanged.
  [`task-actions.ts:29`](../../src/lib/workshop/actions/task-actions.ts#L29)

**Regression coverage**

- UI source checks lock all reversible controls and accessibility attributes.
  [`workshop-ui.test.mts:415`](../../src/workshop-ui.test.mts#L415)

- Database tests cover clearing, completion gates, permissions, and submitted stages.
  [`workshop_foundation.test.sql:1606`](../../supabase/tests/database/workshop_foundation.test.sql#L1606)
