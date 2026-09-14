---
title: 'Redirect completed workshop task to list'
type: 'feature'
created: '2026-09-14'
status: 'done'
route: 'one-shot'
---

# Redirect completed workshop task to list

## Intent

**Problem:** After the final storage-preparation submission completes a workshop task, the operator remains on the now-completed task page.

**Approach:** On a successful Complete storage command, invalidate the workshop list and replace the task route with `/workshop`. Keep command failures on the task page with the existing inline error handling.

## Suggested Review Order

**Completion flow**

- Redirect only after the final command succeeds; failed commands retain existing handling.
  [`WorkshopTask.tsx:339`](../../src/app/workshop/_components/WorkshopTask.tsx#L339)

- Bind the workshop-list redirect exclusively to Complete storage.
  [`WorkshopTask.tsx:752`](../../src/app/workshop/_components/WorkshopTask.tsx#L752)

**List freshness**

- Revalidate the task list only after storage completion is accepted.
  [`task-actions.ts:146`](../../src/lib/workshop/actions/task-actions.ts#L146)

**Regression coverage**

- Lock the success redirect and list invalidation into the workshop UI contract.
  [`workshop-ui.test.mts:846`](../../src/workshop-ui.test.mts#L846)
