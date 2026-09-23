---
title: 'Make the rental dashboard clear and compact'
type: 'bugfix'
created: '2026-09-23'
status: 'in-review'
baseline_commit: '12405c389e455f6a9193379698265f751443dec5'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard separates each direction's orders and bikes into unrelated cards, obscuring their relationship and consuming excessive mobile space. Repeated outlines flatten the visual hierarchy, and the custom date button is shorter than the inputs beside it.

**Approach:** Present each direction as one cohesive orders-and-bikes summary. Establish hierarchy with contrasting surfaces and spacing, compact supporting operational counts, and consistently sized date controls; remove redundant date/Madrid display text.

Order actions must also have consistent placement: long names or delivery addresses must not push an individual Open order button below its row while neighboring actions stay at the top.

## Boundaries & Constraints

**Always:** Use the existing Subframe palette, typography and Button/Badge components. Preserve server-provided totals, URL-owned date state, period validation, Europe/Madrid date interpretation, chronological groups, mobile direction switching, order drawer actions, lifecycle information, safe delivery links and visible error states. Orders and bikes remain explicitly labeled and use correct singular/plural wording. Preserve all seven existing metrics through grouping, including zero values.

**Ask First:** Any requested change to what a metric counts, the data contract, or operational behavior beyond this visual refinement.

**Never:** Introduce database changes, client-side aggregation, external service calls, new dependencies, or changes to shared UI primitives. Do not implement later dashboard stories. Do not treat removing visible Madrid copy as a timezone change.

</frozen-after-approval>

## Code Map

- `src/app/dashboard/_components/DashboardWorkload.tsx`: `DashboardWorkload` owns preset/date controls, seven `Summary` instances and responsive direction layouts. `DirectionList` owns nested outlined sections/rows and order opening. Replace presentation here while preserving interaction handlers and data use.
- `src/app/dashboard/page.tsx`: page wrapper, title/subtitle and error boundaries; adjust surface/spacing and remove Madrid from explanatory copy.
- `src/app/dashboard/loading.tsx`: existing dashboard skeleton; align its surface and summary proportions with the revised page.
- `src/lib/dashboard/workload.ts`: read-only `DashboardDirection.totals` supplies orders, bikes, deliveries, missing_delivery_addresses and outstanding_preparation. Use these values directly; do not infer new metrics.
- `src/lib/dashboard/period.ts`: read-only date resolution and `buildDashboardPeriodHref`; retain current navigation and validation semantics.
- `src/ui/components/Button.tsx`: existing neutral-primary and tertiary variants provide filled/borderless controls. Default button height is h-8, small h-6, large h-10; dashboard-local height overrides must produce 44px computed height.
- `src/ui/tailwind.config.js`: existing neutral, brand, warning and text tokens; reuse without global theme changes.
- `src/dashboard-ui.test.mts`: existing error-state and keyboard-tab regression checks. `package.json` provides `test:dashboard`.
- `_bmad-output/planning-artifacts/ux-designs/ux-echelon-cycling-hub-admin-2026-09-22/DESIGN.md`: retained constraints include existing shell, chronological lists, phone direction switch, explicit warnings and legible contrast. Current user feedback supersedes the excessive outlined presentation.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/_components/DashboardWorkload.tsx` — replace seven independent cards with two directional summaries. Place orders and bikes together on one line per direction; display outgoing delivery, preparation and missing-address counts in a compact, explicitly outgoing supporting strip.
- [x] `src/app/dashboard/_components/DashboardWorkload.tsx` — remove decorative panel/row outlines; use the existing white page background, white list surfaces, pale amber day headings and subtle row separators. Use warning badges for positive attention counts and neutral text for zeros. Keep long identity/address content wrapping and order actions predictably placed.
- [x] `src/app/dashboard/_components/DashboardWorkload.tsx` — give From, To and Apply dates equal 44px heights with aligned bottoms. On phones use two equal-width date fields and a content-sized Apply button beneath; allow presets to wrap. Remove the resolved-date/Madrid span. Preserve visible labels and keyboard focus styling.
- [x] `src/app/dashboard/_components/DashboardWorkload.tsx` — replace content-dependent flex wrapping in order rows with explicit responsive layout: a shrinkable content column and a top-aligned action column on wider screens; one consistent action position below content for every phone row. Wrap long text within its column.
- [x] `src/app/dashboard/page.tsx`, `src/app/dashboard/loading.tsx` — apply the white page surface and responsive spacing; remove location copy from the subtitle and align the loading structure.
- [ ] `src/dashboard-ui.test.mts` — retain existing regression checks, adjusting only if necessary for equivalent markup. Verify the visual scenarios below in-browser; do not add tests that merely assert Tailwind class strings.

**Acceptance Criteria:**
- Given nonzero totals, when viewing the summary, then Going out and Coming back each associate their order count with their bike count, with no independent outgoing/incoming bike cards.
- Given a 375px phone viewport, when viewing the dashboard, then the two direction summaries share one compact row, supporting counts wrap legibly, and no page-level horizontal overflow occurs.
- Given a desktop viewport, when reading the workload, then both lists remain side by side and backgrounds, headings and spacing distinguish controls, summaries, days and rows without nested outlined cards.
- Given custom dates, when inspecting and submitting the controls, then the inputs and Apply button have equal heights, desktop baselines align, and existing URL navigation and validation still work without the redundant date/Madrid span.
- Given zero or singular totals and long customer/address text, when rendering, then counts remain explicit, grammar is correct, content wraps, and actions remain usable.
- Given adjacent orders with short and long names/addresses, when viewing wider screens, then every Open order button stays at the top right of its row; on phones every action uses the same below-content placement, independent of text length.
- Given loading, empty or failure states, when opening the page or changing periods, then the updated layout preserves explanatory feedback and does not present a failed load as successful zero workload.
- Given the phone direction switch, when using arrow keys or tapping a direction, then selection, focus and the corresponding list continue to work; Open order still invokes the existing drawer.

## Spec Change Log

## Design Notes

Primary summary example: **Going out — 1 order · 3 bikes** alongside **Coming back — 2 orders · 5 bikes**. Below, compact outgoing details show **1 delivery order**, **2 bikes need preparation**, and **0 delivery addresses missing**. These are presentations of existing aggregates, not new calculations. Reserve stronger warning color for actionable positive counts; retain text labels so color never carries meaning alone.

## Verification

- `npm run test:dashboard` — existing dashboard period, UI and delivery checks pass.
- `npx tsc --noEmit` — no introduced type errors.
- Targeted ESLint on changed dashboard files — no introduced lint errors.
- `git diff --check` — no whitespace errors.
- Browser inspection at 375px, 768px and 1440px: compare against the reported problems; inspect computed control heights, wrapping, focus, direction selection and drawer opening. Include zero/singular counts and long content where available. Record any unavailable authenticated/browser evidence explicitly; do not claim static checks prove layout quality.


## Implementation Evidence

- Implemented grouped counts, compact outgoing detail counts, surfaces, row action columns, date controls and matching loading layout.
- `npm run test:dashboard`: 8 tests passed. These cover period logic and existing source-level UI checks, not rendered layout.
- `npx tsc --noEmit`, targeted ESLint and `git diff --check`: passed.
- Three review layers completed. Added `aria-pressed` and retained the orange selected preset variant; no data contract changes.
- Browser verification blocked: browser CLI unavailable; opening the existing local dashboard with computer-use tools hung and was aborted. No viewport screenshots, computed-height measurements or authenticated drawer verification obtained.
- Status remains `in-review` because visual acceptance at 375px, 768px and 1440px is still unverified. The test/visual-verification task remains open.


## User-directed refinement, 2026-09-23

- User rejected the grey page background and neutral selected presets. Restored white page/loading backgrounds and orange selected preset styling.
- Date controls and row actions now use dashboard-scoped CSS for explicit 44px sizing, content-sized buttons and responsive column layout. The Apply button no longer stretches across its grid track.
- Delivery destinations have a pale amber block with a clear label and darker body text. Missing addresses have a red warning block. Grouped summaries and day headers use pale amber rather than grey.
- Safari desktop screenshot verified white canvas, orange Next month selection, compact aligned Apply button, top-right order actions and red missing-address warnings. Today selection updated URL, dates and returned workload in the accessibility tree.
- Browser access was granted after initial capture denial. Full phone/tablet viewport checks and drawer opening remain unverified; retain in-review status.
- Re-ran TypeScript, targeted ESLint, all eight dashboard tests and whitespace checks successfully. PostCSS compilation confirmed explicit control heights, desktop columns and address background colors.
