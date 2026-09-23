---
name: Echelon Operations Dashboard
description: High-level dashboard composition inheriting the existing Echelon Subframe UI.
status: final
created: 2026-09-22
updated: 2026-09-22
sources:
  - .memlog.md
  - ../../../specs/spec-operations-dashboard/SPEC.md
  - ../../../specs/spec-operations-dashboard/ARCHITECTURE-SPINE.md
  - ../../../specs/spec-operations-dashboard/data-contract.md
  - ../../../specs/spec-operations-dashboard/verification.md
ui_system: Echelon Subframe
ui_system_source: ../../../../src/ui/tailwind.config.js
colors: {} # All colors inherit the named Subframe tokens; no palette overrides.
typography:
  heading:
    note: 'Subframe heading-2 / font-heading-2'
  section:
    note: 'Subframe heading-3 / font-heading-3'
  body:
    note: 'Subframe body / font-body'
  emphasis:
    note: 'Subframe body-bold / font-body-bold'
  metadata:
    note: 'Subframe caption / font-caption'
rounded: {} # Inherit Subframe sm/md/lg/full.
spacing: {} # Inherit existing Tailwind/Subframe scale and page spacing.
components:
  dashboard-row:
    foreground: 'Subframe default-font'
    background: 'Subframe default-background'
    border: 'Subframe neutral-border'
    typography: '{typography.body}'
  day-heading:
    background: 'Subframe neutral-50'
    typography: '{typography.emphasis}'
  status:
    neutral: 'Subframe Badge neutral'
    warning: 'Subframe Badge warning'
    critical: 'Subframe Badge error'
---

# Operations Dashboard — Design

## Brand & Style

Use the existing Echelon Subframe visual identity and app shell. This document defines a dashboard composition, not a new design system. [EXPERIENCE.md](EXPERIENCE.md) owns behavior. The paired spines take precedence over reference images and later mocks; upstream product and architecture rules retain their authority.

## Colors

Inherit `default-background`, `default-font`, `subtext-color`, `neutral-border`, `brand-*`, `warning-*`, `error-*`, and `success-*` from the [existing theme](../../../../src/ui/tailwind.config.js). No color overrides. Operational warnings use existing semantic variants with explicit text; brand emphasis alone never means urgency.

Implementation must verify at least 4.5:1 contrast for normal text, 3:1 for large text and meaningful control/focus indicators. Inheritance is not proof that every rendered combination meets these targets.

## Typography

Use {typography.heading} for the page, {typography.section} for directions, {typography.emphasis} for times and day headings, {typography.body} for operational information, and {typography.metadata} for supporting context. These reference the existing Geist scale; introduce no new font or type ramp. Time and readiness must remain readable without opening an order.

## Layout & Spacing

Reading order: header and shared date/sync controls → workload summary → concise attention → directional order lists. On Windows tablet/laptop and other laptops, Going out and Coming back sit side by side. On phones, a visible direction switch occupies the same location above a single list. Keep the shared range above both directions.

The [tablet/laptop reference](mockups/key-dashboard-tablet.html) illustrates Today and Next 7 Days; the [phone reference](mockups/key-dashboard-phone.html) illustrates both direction selections. They use a compact shared summary, clear day separators and an explicit order-opening affordance. These are static fictional content references, not functioning Subframe screens. Their schematic device frames and demonstration CSS are not new app-shell or breakpoint requirements.

Within each direction, day headings visibly separate multi-day groups; times align consistently down the list. Today and Tomorrow remain chronological. Row information can wrap rather than shrink to fit. Use existing app spacing and component sizing; exact density and breakpoint fit require a later visual check on the actual Windows device.

## Elevation & Depth

Inherit existing app and Subframe shadows, borders and overlay treatment. The Order drawer remains the existing overlay; dashboard rows do not become new floating detail surfaces.

## Shapes

Inherit the existing theme radii and each reused component's defaults. No dashboard-specific shape overrides.

## Components

Names below describe compositions, not a request to create new UI primitives.

| Component | Visual contract / reuse |
|---|---|
| App shell | Existing DefaultPageLayout and navigation; Dashboard is the first staff item and Workshop remains visible. |
| Shared period control | Existing Select/Calendar/Button family; one clearly labeled control above both directions, showing the resolved dates. |
| Sync control and confidence | Existing Button, Progress and Alert presentation; adjacent scope, progress and outcome text, visually separate from workload totals. |
| Workload summary | Existing text/surface styles; concise labeled counts for both directions, delivery and preparation workload. Keep time-based lists prominent. |
| Attention summary | Existing Alert/Badge vocabulary with concise counts; avoid repeating each row warning in a second large card. |
| Direction switch | Existing Tabs visual language with two fully visible labels; selected state must remain clear on a phone. |
| Day heading | {components.day-heading}; clear date separator and relevant day totals within each direction. |
| Order row | {components.dashboard-row}; time first, customer/order identity, fulfillment and preparation/lifecycle information next, delivery details and warnings beneath where applicable. |
| Readiness and warning labels | {components.status}; use readable counts and state words. Mixed lifecycle displays several named counts rather than a misleading ready fraction. |
| Delivery details | Existing body/link styling; supplied destination remains readable, estimate and attribution are supporting text. |
| Order drawer | Existing OrderDetailsDrawer visual structure and skeleton; current bike-task links use its existing content vocabulary. |
| Workshop task screen | Existing Workshop task UI, unchanged by this high-level dashboard design. |
| Feedback state | Existing Alert for failures, existing skeleton vocabulary for loading, plain explanatory text for empty sections. |

## Do's and Don'ts

- Preserve Booqable's useful date grouping and two-direction organization, illustrated in the [user reference](imports/booqable-dashboard-reference.png).
- Preserve Echelon's own shell, components and styling. The reference does not authorize its sidebar, blue palette, avatars, reports or extra filters.
- Keep operational labels and warnings visible without hover; preserve chronological context even when an issue is critical.
- Do not use decoration, charts or financial metrics to displace the departure/return lists.

Final high-level contract. User confirmed the dashboard visual coverage and chose to skip additional validation. The existing Order drawer and Workshop task screen remain covered by the spines and their existing app designs. HTML references were source-checked; browser/device rendering and accessibility verification remain implementation work.
