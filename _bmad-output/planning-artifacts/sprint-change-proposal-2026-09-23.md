---
title: 'Sprint change proposal: Dashboard Story 1.5'
date: '2026-09-23'
status: 'owner-directed story creation'
change_scope: minor
---

# Sprint change proposal: Dashboard Story 1.5

## 1. Issue summary

After Story 1.4, the Dashboard exposes sync run diagnostics that staff do not need for routine use. Owner feedback asks for a single selected-period Sync action, a blocking full-screen loader while it runs, the time of the last successful Dashboard sync, and clear errors. Staff should never need a Resume button; another Sync click handles an interrupted run. The owner also observed delayed period navigation without a visible full-page loader, zero-value notification badges, a plain-text delivery address, and duplicate readiness labels. An empty Priority summary is meant to disappear.

## 2. Impact analysis

- **Epic:** The Operations Dashboard epic remains viable. This is a small follow-up to its implemented presentation, not a new epic or a change to sync coverage.
- **Stories:** Keep completed 1.1–1.4 as historical delivery records. Add standalone Story 1.5 for the requested design and corrections.
- **Product/architecture:** The canonical Dashboard SPEC and architecture still govern selected Madrid scope, trustworthy completion, staff authorization, recovery, SQL-owned workload, destination precedence, and safe external navigation. Simplifying visible details does not relax those rules.
- **UX:** The existing high-level UX calls for concise feedback and skeleton loading, but there is no specific Subframe design for the Dashboard sync block. Story 1.5 starts with `/subframe:design` and implements its resulting design.
- **Code:** Likely touch points are `DashboardSync.tsx`, `DashboardWorkload.tsx`, `DashboardNotices.tsx`, the Dashboard loading boundary, and the selected-period health reader. The `Attention` component already returns nothing for an empty item list; that behavior needs a regression check. `loading.tsx` exists; client navigation needs browser verification before choosing a fix.
- **Artifacts:** No repository PRD file was found. The canonical Dashboard SPEC and companion architecture/data/verification documents serve as the existing requirements baseline. This proposal adds a story without rewriting them or the epic plan.

## 3. Recommended approach

**Direct adjustment: add Story 1.5.** Effort is small to medium, concentrated in UI behavior and verification; risk is low to medium because simplification must preserve truthful sync results and date scope. A rollback of Story 1.4 would lose needed selected-period synchronization and recovery. MVP goals remain intact. The main sequence is Subframe sync-block design, implementation, then focused local and browser verification.

## 4. Specific change proposals

| Surface | Current → proposed | Reason |
|---|---|---|
| Story 1.4 sync UI | Saved range, counters, discovery state and Resume controls → one Sync action, a blocking loader during sync, last successful Dashboard sync timestamp and clear error | Matches the staff task without obscuring failure or claiming coverage of a different period. |
| Dashboard date navigation | Existing skeleton file, but observed delayed transitions → reliably show a full Dashboard content skeleton until the new period is ready | Makes filter and date-picker actions visibly responsive. |
| Summary/attention | Optional zero-value badges appear; priority block already guards empty lists → omit zero-valued optional notices and preserve empty priority hiding | Removes non-actionable alerts. |
| Delivery address | Supplied address is plain text → link its exact text to a Google Maps search | Makes a useful destination action available without changing source data. |
| Order readiness | Ready fraction plus identical lifecycle count → one readiness statement per fact | Improves row scanability without losing distinct lifecycle states. |

The executable acceptance criteria and verification handoff are in [Story 1.5](../implementation-artifacts/story-1-5-simplify-dashboard-feedback-and-loading.md).

## 5. Handoff

**Owner decision:** The request to create Story 1.5 and subsequent sync-flow clarification authorize this planning artifact. **Developer handoff:** Begin with the Subframe design, record its link, then implement AC1–AC7 in the story. Preserve Story 1.4 backend guarantees, remove manual Resume from the Dashboard, and verify the blocking sync loader, date-navigation skeleton, success/error truthfulness, and all four marked UI observations. No deployment, live tenant operation, or remote database change is part of this handoff.
