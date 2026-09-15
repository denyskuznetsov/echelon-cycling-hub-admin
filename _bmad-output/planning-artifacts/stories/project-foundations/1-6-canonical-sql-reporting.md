---
title: Canonical SQL reporting and complete exports
story_id: '1.6'
epic_id: '1'
review_recommendation: DB-3
requirements: [FR6]
status: backlog
priority: high
created: '2026-09-15'
hard_dependencies: []
---

# Story 1.6: Canonical SQL reporting and complete exports

**Epic:** [Reliable Project Foundations for Continued Growth](../../epics.md)
**Source:** [Review DB-3](../../reviews/project-foundations-review-2026-09-15.md#db-3--give-reporting-one-sql-source-of-truth)

## User story

As a partner or staff member checking performance and commission reports,
I want the dashboard and downloaded report to use the same financial rules and complete data,
So that totals reconcile and growth does not silently omit orders from exports.

## Review context and evidence

`OverviewStats.tsx` computes totals/commissions in React; `download-report/route.ts` repeats those calculations and retrieves orders without pagination. `get_partner_daily_stats` aggregates by day but does not supply a complete canonical reporting contract. `normalizeCommissionRate` interprets values at or below 1 as fractions and larger values as percentages. The SQL cancellation filter is commented out. The local API cap is 1000 rows; deployed limits and intended financial policies were not verified.

Entry points:

- `src/app/partner/_components/OverviewStats.tsx`.
- `src/app/api/partners/download-report/route.ts`.
- `src/app/partner/_lib/loadPartnerOverview.ts`: daily stats and commission normalization.
- `src/app/partner/(me)/overview/page.tsx`, `src/app/partner/[slug]/overview/page.tsx`.
- `supabase/migrations/20260608102505_remote_schema.sql`: `get_partner_daily_stats`, partners/orders/views.
- `supabase/config.toml`: `api.max_rows`.

## Scope

- Agree and document one reporting contract covering eligible orders/statuses, date boundaries/time zone, money units, commission representation, rounding, and the currently displayed tax-inclusive/exclusive amounts.
- Implement PostgreSQL-owned totals and line/day calculation outputs consumed by both dashboard and export.
- Retrieve all authorized export rows with deterministic paginated/bounded reads and a defined consistency model.
- Preserve authorized partner filtering and user-facing report fields unless explicitly agreed. Exclude commission-policy redesign, historical settlement/accounting features, and fetching all rows to perform JavaScript aggregation.

## Acceptance criteria

### AC1 — Rules are explicit

**Given** the current data and business expectations, **When** the reporting contract is approved for implementation, **Then** it specifies the canonical rate representation, included statuses, date field/time zone/boundaries, rounding level, and tax calculations with concrete fixtures; **And** ambiguity is not resolved through undocumented heuristics.

### AC2 — One calculation owner

**Given** identical partner and timeframe inputs, **When** dashboard and CSV are generated, **Then** PostgreSQL supplies their business totals/commissions using the same rules, both agree on counts and monetary results, and UI/API JavaScript only formats the outputs rather than independently recomputing business aggregates.

### AC3 — Complete export beyond the API cap

**Given** an authorized result set larger than the configured single-request row cap, **When** export runs, **Then** every eligible row is retrieved exactly once with deterministic ordering and bounded pages; **And** exported rows reconcile with the report totals under the documented consistency model.

### AC4 — Edge cases and rounding

**Given** empty periods, boundary dates, small/fractional commissions, zero values, and every supported order status, **When** reporting runs, **Then** SQL test fixtures demonstrate the approved inclusion and rounding rules and produce consistent daily, line, and overall values.

### AC5 — Access control

**Given** a partner, another partner, a mechanic, and authorized staff, **When** they request reports or call the underlying views/RPCs directly, **Then** the existing approved reporting permissions and partner isolation are enforced without a service-role bypass.

### AC6 — Failure and concurrency semantics

**Given** an export page fails or source data changes during pagination, **When** the operation completes, **Then** the approved snapshot/cutoff/retry behavior is honored, partial data is not presented as a complete report, and a recoverable error is surfaced when consistency cannot be met.

## Implementation notes and constraints

Read `AGENTS.md`: all business math and cross-table aggregation remain in PostgreSQL. Use security-invoker views or appropriately authorized RPCs. Add forward idempotent migrations and validate locally; hosted deployment remains merge/CI only. Decide whether existing mixed commission representations need a data migration before changing interpretation. Do not silently exclude canceled orders or change current tax/rounding policy.

## Verification

- SQL fixtures for agreement, units, rounding, statuses, date boundaries, and RLS.
- An export dataset beyond the local API cap, including tied sort values, validates completeness and no duplication.
- Inject a failed intermediate page and a concurrent change; verify the specified consistency/error outcome.
- Compare actual dashboard/API consumption of SQL outputs; run TypeScript, focused tests, and local migration replay/reapplication.

## Decisions at pickup

- Confirm whether commission rates are fractions or percentages and how existing ambiguous values are interpreted.
- Confirm cancellation/status inclusion, historical rate behavior, date/time-zone ownership, and tax/rounding expectations.
- Choose an export consistency approach and agreed behavior for data changes during export. These decisions must precede dependent SQL, not be guessed.

## Independence and coordination

No hard dependency. Own the SQL contract, migration/data correction if approved, loaders, dashboard/export adaptation, and tests. Use generated types if Story 1.8 has landed and regenerate them; otherwise use current clients without blocking delivery. This story owns report arithmetic and export pagination, not the general API validation framework.

## Completion record

Implementation has not started in this recording task. Record the approved reporting contract, fixtures, migration changes, dashboard/export reconciliation and completeness evidence, residual limits, and final status; update the epic index.
