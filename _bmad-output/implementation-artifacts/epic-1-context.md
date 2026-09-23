# Epic 1 Context: Plan and run daily rental operations from one dashboard

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give authorized staff one trustworthy, selected-period starting point for daily rental work: departures, returns, preparation status, delivery information, existing order and Workshop journeys, and explicit source-refresh confidence. This removes routine cross-checking between Booqable and Workshop while preserving existing workflows, permissions, and the limits of available evidence.

## Stories

- Story 1.1: Browse the rental workload and readiness dashboard
- Story 1.2: Identify preparation priorities and open the relevant Workshop task
- Story 1.3: See approximate driving time for deliveries
- Story 1.4: Refresh the selected period and understand sync confidence

## Requirements & Constraints

- Staff roles are admin, manager, and mechanic. Dashboard Today is their default destination when no valid internal destination was supplied; Dashboard is first in staff navigation. Partner, pending, and anonymous callers must be denied at direct data boundaries as well as in navigation.
- A single shared period controls both directions and summary data. Support Today, Tomorrow, Next 7 Days, following Monday–Sunday, next complete calendar month, and inclusive custom dates in Europe/Madrid. URL state survives refresh, history, and drawer navigation. Invalid or reversed dates must be correctable rather than silently broadened.
- Show coherent chronological Going out and Coming back workloads, with Madrid date groups for multi-day ranges and shared totals for outgoing/incoming orders and bikes, deliveries, outstanding preparation, and missing-address deliveries. An eligible order may appear in both directions; missing schedule excludes only that direction.
- Include reserved, started, and stopped orders by their independently scheduled start and return dates; exclude new, draft, cancelled, and archived orders. Preserve selectable rows with missing customer or order number, including the explicit missing Booqable-number message.
- Readiness uses current non-cancelled rental-turnaround tasks on open assignments, including completed tasks while still current. History, checklists, add-ons, and retained records do not affect task denominators. Preparation is only to_prepare, being_prepared, and needs_recheck for outgoing work. Zero tasks consistently reads “No Workshop tasks” without inferred missing bikes or urgency.
- Delivery destination is a nonblank delivery address, otherwise a nonblank maps link. Whitespace is absent; billing and customer addresses are never fallbacks. An absent destination reads “Delivery address missing”; supplied but unroutable input remains supplied and is not counted as missing.
- Failed reads, invalid ranges, empty directions, absent detail, and optional ETA failure must remain distinct. Core loading uses skeletons, not placeholder zeroes. Dashboard reads and notices never mutate orders, tasks, or provider data.
- Preserve the existing Orders, Workshop, role, source-apply, and whole-order pickup/return behaviors. The epic excludes booked-unit completeness auditing, cross-order predictions, task editing or historical-task browsing, delivery dispatch/routing workflows, Booqable write-back, customer messaging, and analytics.

## Technical Decisions

- PostgreSQL owns workload selection, aggregation, day grouping, task denominators, and period totals through one staff-authorized SECURITY INVOKER read under RLS. Pre-aggregate inputs to avoid join fan-out; do not calculate business workload data in Node or the client, make per-row detail calls, or silently truncate a result set.
- Capture one server reference instant and use DST-safe Madrid bounds consistently for membership, labels, and later urgency. Revalidation replaces rows, totals, dates, reference time, and derived status together.
- Use authenticated/RLS-respecting clients for workload and drawer data. Apply authorization at workload, selected-task, ETA, and sync start/resume boundaries. Server actions use the established `withAuth` behavior and discriminated expected errors; loaders provide safe fallback data with a visible, contextual error.
- Reuse the existing navigation configuration, post-login handling, shared order drawer/opening mechanism with `?order=<local UUID>`, and Workshop task routes. Selected order data must not overwrite the workload snapshot.
- Add migrations only with their owning story, make them idempotent, verify locally, and preserve legacy sync data or provide an explicit restart path. Remote database changes and deployments remain outside implementation scope and follow existing branch CI.
- Delivery estimates belong to a separate, server-authorized Google Routes adapter. It rereads the local order and sends only a verified origin and supported destination. Bound timeouts, concurrency, response size, and within-load deduplication; do not add retry loops, polling, persistent caching, credential exposure, Maps HTML scraping, or arbitrary routing proxy behavior.
- Selected-period refresh extends the existing manual reconciliation worker, leases/fences, complete-snapshot validation, and environment gate. Persist the requested bounds, policy version, discovery progress, and outcomes; resume saved server scope without trusting a later client cursor. Do not introduce a scheduler, detached work, or a second worker system.

## UX & Interaction Patterns

- Keep the existing Echelon Subframe shell, typography, semantic colors, spacing, overlays, and components. The page order is shared period/sync controls, workload summary, concise attention, then directional chronological lists; no charts, financial dashboard, or new design system.
- On tablet/laptop, show Going out and Coming back side by side. On phones, show one active list beneath a visible two-label accessible tablist. Switching direction preserves the period and does not start a sync. Rows prioritize time, identity, fulfillment, readiness/lifecycle, destination, and plain-text warnings; essential details wrap under zoom and never depend on hover or color alone.
- One explicit, focusable order action opens the existing drawer, preserving URL parameters, history, Escape/Back behavior, and focus return. Story 1.2 adds staff-authorized current bike-task links inside that drawer, not direct task-edit controls on the dashboard.
- Use concise factual status copy: exact lifecycle counts for mixed work, “No Workshop tasks,” “Delivery address missing,” “Drive time unavailable,” and “Sync confidence unavailable” when evidence is not sufficient. Keep attention prioritized without reordering timelines or duplicating every issue in a large alert.
- Maintain semantic headings, labeled controls, date groups, visible focus, keyboard and touch access, controlled announcements, reduced-motion feedback, 44px primary controls, contrast, and reflow support. Verify the rendered tablet, phone, and zoom behavior during implementation.

## Cross-Story Dependencies

Story 1.1 establishes the staff landing, shared calendar, coherent workload read, delivery precedence, responsive lists, and shared order opening. Story 1.2 extends its task predicates with urgency, attention, and selected-order Workshop links. Stories 1.3 and 1.4 each depend on 1.1 but not on each other: 1.3 adds independent delivery estimates, while 1.4 extends existing sync infrastructure and confidence controls. Before those stories arrive, show destinations without simulated estimates and limit sync status to proven legacy evidence or “Sync confidence unavailable.” Full rollout additionally requires measured performance targets and routing operational verification; those are release gates, not separate product stories.
