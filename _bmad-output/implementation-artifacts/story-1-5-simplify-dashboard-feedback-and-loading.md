---
title: 'Story 1.5: Simplify Dashboard sync feedback and polish the daily briefing'
type: story
created: '2026-09-23'
status: design-drafted
source: 'Owner feedback on the implemented Dashboard and Story 1.4'
depends_on: ['Story 1.1', 'Story 1.2', 'Story 1.3', 'Story 1.4']
---

# Story 1.5: Simplify Dashboard sync feedback and polish the daily briefing

As a staff member checking rental operations,
I want one clear way to refresh the dates I am viewing, a visible loading state when I change dates, and concise actionable information,
so that I can trust the Dashboard without interpreting sync diagnostics or duplicate labels.

## Context and boundary

The implemented Story 1.4 displays saved-run dates, check time, succeeded/failed/candidate counts, discovery pages, and several recovery controls in the main Dashboard. Owner feedback on 23 September 2026 asks for the simpler Workshop-like experience: click Sync for the selected period, then see the time of the last successful sync and any actionable error. Browser comments on the same Dashboard ask for zero-valued notifications to disappear, an empty priority block to disappear, address text to open Google Maps, and duplicate readiness labels to be consolidated. Period changes currently feel blank or stalled even though a route `loading.tsx` skeleton exists.

This is a focused follow-up to the completed Stories 1.1–1.4. Preserve the selected-period discovery, fixed Madrid date bounds, staff authorization, environment gate, bounded continuation, reconciliation safeguards, truthful completion rules, and durable recovery. Simplify the user experience and fix the observed Dashboard behavior. No new sync engine, provider write, schema redesign, or broader planning revision is part of this story.

## Subframe design handoff

[Story 1.5 Dashboard flow](https://app.subframe.com/ee500777c863/flow/e7b8f32d-9d54-47ba-afa5-73fa04b36553/edit) contains five visual states: [ready](https://app.subframe.com/ee500777c863/design/75ec598e-e631-44e7-8e84-d19ee4115b03/edit), [syncing](https://app.subframe.com/ee500777c863/design/401ad79d-4848-44be-9acc-5c187c9cfeb2/edit), [sync failed](https://app.subframe.com/ee500777c863/design/09e66948-21fb-4cf6-9c53-71d9d227b9a0/edit), [dates loading](https://app.subframe.com/ee500777c863/design/b67ca7a0-cd78-487a-a0b9-798d5f489792/edit), and [no issues](https://app.subframe.com/ee500777c863/design/6e37f350-72ee-4fb5-9db9-796c8824bacf/edit). These are design drafts for review and implementation guidance. The sync overlay and skeleton are separate states; the Subframe pages do not implement the interaction, focus, or data behavior in the acceptance criteria.

Owner review of the flow requested a simpler control layout: the Period presets occupy the top row of one wide left section, the From/To pickers and Apply dates occupy its second row, and the Sync control stays in a distinct section on the right. This correction is applied across all five Subframe states, with the Sync section stacking below Period on mobile.

## Design first

Before implementing the sync presentation, use `/subframe:design` in the connected Echelon Subframe project to design the Dashboard sync control and its idle, full-screen blocking loader, success, unavailable, and error states in the existing Dashboard layout. Include tablet/laptop and phone behavior, the single Sync action, the last-success timestamp, and clear actionable errors. Review the design against Echelon's existing theme and Workshop feedback patterns. Record the resulting Subframe page/component link in the implementation handoff, then implement that approved design. This design step is part of Story 1.5; the current large refresh card is not its visual specification.

## Acceptance criteria

### AC1 — One selected-period Sync action

Given an authorized staff member has selected Today, Tomorrow, Next 7 days, Next week, Next month, or valid custom dates,
when they click **Sync**,
then the service refreshes Booqable orders for those exact selected Madrid dates, covering the Story 1.4 outgoing/returning eligibility and locally captured in-window candidates,
and the selected bounds remain fixed if the user changes the date filter or the run crosses midnight.

The user sees one primary Sync control and no Resume control. Bounded server continuation happens automatically behind that click. If work is interrupted, the next Sync click safely continues or restarts it according to the existing run contract; staff are not asked to select or resume a saved run. Do not expose run IDs, discovery pages, candidate counters, or a list of saved runs in the Dashboard. Never report success for incomplete enumeration or unresolved required orders.

### AC2 — Minimal, truthful sync feedback

Given a successful selected-period Dashboard sync,
when the sync UI settles,
then it shows the local Europe/Madrid date and time of the **last successful Dashboard sync** and no succeeded/failed/candidate totals or technical saved-range details.

That timestamp comes from a successful Dashboard selected-period run, not an unrelated Workshop or legacy run. It is a historical timestamp, not a claim that the currently viewed period was checked. Changing the period does not silently relabel an older success as coverage for the new dates. If there has been no successful Dashboard sync, use brief neutral text instead of an invented timestamp. During a run, show a full-screen loading state that blocks Dashboard interaction until sync completes or fails. Make the loader accessible and visibly indicate that Booqable orders are syncing; prevent duplicate starts and period changes while it is active. On failure or interruption, remove the blocker, keep the previous successful timestamp, show a clear error, and let staff click the same Sync button again. Preserve useful errors and the existing environment-unavailable message; never present a failed or partial run as successful.

### AC3 — Visible full Dashboard skeleton on date changes

Given staff choose a preset or apply valid custom dates,
when the URL-driven Dashboard workload is loading,
then a full-page Dashboard content skeleton appears promptly and stays until the new period's header, summary, attention, and both directional lists are ready to display together.

The skeleton must cover the actual Dashboard content shape at desktop/tablet and phone widths. Old rows and counts must never appear under the new period label. Do not replace a loaded page with fake zero totals. Preserve date selection, invalid-range feedback, keyboard access, reduced-motion behavior, and an explicit workload error state. Verify the existing route `loading.tsx` during client navigation and adjust the route/Suspense boundary only as needed to make this behavior reliable.

### AC4 — Hide zero-valued notifications

Given any optional Dashboard notification, badge, or attention item whose value is zero,
when the workload renders,
then that item is absent rather than displaying a `0` warning or neutral notification. This includes missing delivery addresses and preparation counts in the outgoing summary and other count-based notices of the same kind. Keep the core order/bike workload totals visible even when they are zero, so an empty period remains understandable. Do not suppress an actual error merely because an associated count is unavailable.

### AC5 — Hide an empty priority block

Given there are no actual warning, critical, or other actionable priority items for the selected period,
when the Dashboard renders,
then the entire Priority summary block is absent. This is already the intended `Attention` behavior; preserve it while simplifying zero-valued notices. If any real item exists, show the block with only those items.

### AC6 — Open plain delivery addresses in Google Maps

Given a delivery order has a nonblank `delivery_address` displayed as plain text,
when staff activate that address,
then Google Maps opens a search for that exact supplied address in a new tab, with a descriptive accessible link name and safe external-link attributes. Display the original address text unchanged and do not require a successful drive-time estimate. Continue to use an existing safe `maps_link_order` directly when it is the selected source. Missing or whitespace-only destinations must not become links. The link is navigation only; it does not alter SQL destination precedence, routing inputs, or order data.

### AC7 — One readiness message per fact

Given an order's current bike tasks are all ready for pickup,
when its order row renders,
then it shows one clear readiness statement rather than both `1/1 ready for pickup` and `1 ready for pickup`. Apply the same rule to other duplicate count/status combinations. Preserve the accurate current-task denominator, zero-task message, and distinct later lifecycle statuses from Stories 1.1–1.2. Do not hide a different condition such as `1 to prepare` or fulfillment type `Pickup` merely because it appears beside readiness.

## Verification and handoff

- Check all preset ranges and valid custom dates. Start a sync, confirm the blocking loader prevents changing the period or starting another sync, and verify the exact saved scope and success criteria through existing local fixtures. No live tenant access is required for this story.
- Check a successful run, no prior success, failed/partial/interrupted run, another click on Sync after interruption, health-load failure, and environment-disabled state. Confirm the displayed timestamp is sourced from the correct successful Dashboard run, a failure leaves the prior timestamp intact, and no Resume button appears.
- In a browser, exercise preset and custom date navigation under a deliberately delayed workload read. Confirm the full skeleton appears, old-period content does not wear the new label, and success/error content replaces the skeleton coherently at tablet and phone widths.
- Check zero and positive notification counts, empty and populated priority lists, a text address, a supplied Maps link, and all-ready/mixed/zero-task order rows. Verify link keyboard behavior, focus, text wrapping, and visible status at zoom.
- Reuse existing dashboard UI/period tests and add only focused tests for behavior that could regress. Record Subframe design link and local test/browser evidence separately from provider or deployment evidence.

**Implementation owner:** Developer after the Subframe design is ready. **Scope:** one follow-up story; no change to the existing Epic 1 story contracts is needed to start it.
