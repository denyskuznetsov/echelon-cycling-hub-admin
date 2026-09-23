# Epic 1 Context: Plan and run daily rental operations from one dashboard

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give authorized staff one selected-period view of departures, returns, preparation, and delivery information so they can identify immediate work, open existing order and Workshop journeys, and explicitly refresh source data. Reduce routine comparison of Booqable and Workshop while preserving permissions, established workflows, and trustworthy completion and recovery.

## Stories

- Story 1.1: Browse the rental workload and readiness dashboard
- Story 1.2: Identify preparation priorities and open the relevant Workshop task
- Story 1.3: See approximate driving time for deliveries
- Story 1.4: Refresh the selected period and recover interrupted syncs
- Story 1.5: Simplify Dashboard sync feedback and polish the daily briefing

## Requirements & Constraints

- Admin, manager, and mechanic land on Dashboard Today unless a valid internal destination was supplied. Preserve partner/pending handling and deny partner, pending, and anonymous direct access.
- One URL-owned period controls both directions and totals: Today, Tomorrow, Next 7 Days, following Monday–Sunday, next complete calendar month, or inclusive custom dates. Use Europe/Madrid and DST-safe boundaries; reject malformed or reversed dates.
- Show chronological Going out and Coming back groups with coherent day/period totals. Include reserved, started, and stopped orders by scheduled start/return independently; exclude new, draft, canceled, and archived. Missing identity and zero tasks do not erase eligible rows.
- Bike denominators and task links use current non-cancelled rental-turnaround tasks on open assignment instances, including completed tasks while current. Keep partner units separate; exclude retained history, checklists, and add-ons. Outstanding preparation comprises to_prepare, being_prepared, and needs_recheck. Zero tasks means “No Workshop tasks,” without invented missing units or urgency.
- Resolve destination from nonblank delivery_address, then maps_link_order, retaining supplied value and provenance. Billing/customer addresses are not fallbacks. Distinguish missing destination from supplied but unroutable input.
- Apply preparation urgency only to today's outgoing preparation using the shared reference instant: more than six hours low emphasis, more than two through six hours warning, two hours or less critical. Later lifecycle and zero-task states do not escalate. Notices require evidence and never mutate operations.
- Preserve selected-period discovery, fixed bounds, authorization, environment gates, bounded continuation, complete-snapshot reconciliation, and durable recovery when simplifying presentation. Success requires complete enumeration and successful reconciliation of every required candidate.
- Keep scope bounded: no booked-unit completeness audit, cross-order turnaround prediction, per-bike fulfillment redesign, delivery dispatch, customer messaging, provider write-back, or duplicate detail/task workflow. Local implementation does not authorize deployment, live tenant operations, or remote database changes.

## Technical Decisions

- One staff-authorized SECURITY INVOKER PostgreSQL read under RLS owns selection, aggregation, and totals. Pre-aggregate independent inputs to prevent join fan-out; avoid client/server workload math, per-row detail requests, and silent truncation. No unapproved date-range cap.
- Capture one reference instant for date membership, labels, and urgency. Replace dates, rows, totals, and derived status coherently on revalidation.
- Enforce trusted roles at workload, selected-task, ETA, and sync start/continuation boundaries. Dashboard/drawer reads use user RLS clients; the service-role exception is limited to authorized backend reconciliation.
- Reuse the shared order drawer and current Workshop journey. Selected-order task links use the workload's current-task scope; later detail reads do not overwrite coherent workload counts.
- Load optional Google Routes estimates independently. Authorize local order IDs, reread destinations, send only needed routing inputs, bound execution, and match results to current inputs. Unsupported, ambiguous, or failed routes leave the destination visible with “Drive time unavailable.” No arbitrary proxy, Maps scraping, retry loop, or persistent ETA cache.
- Extend existing sync infrastructure and leases/fences. Discover source start OR return matches plus locally eligible in-window candidates captured at run start, including candidates later canceled or moved. Deduplicate source IDs and persist versioned scope, exact dates/bounds, discovery progress, and per-order outcomes. Continuation uses saved bounds across navigation/midnight; client state cannot widen them. Use bounded awaited work without detached processing or a second worker engine.
- Preserve legacy scope meaning and distinguish failure, incomplete work, and empty workload. Retries replace outcomes; skipped/deleted/unavailable candidates cannot become successful refreshes. Any migration must be idempotent, locally verified, and delivered remotely through branch CI.

## UX & Interaction Patterns

- Inherit Echelon Subframe styling: shared period/sync controls, workload summary, concise attention, then dominant directional lists. Tablet/laptop shows both directions; phones show two visible accessible direction labels above one list. Preserve readable wrapping, zoom, and chronological order.
- Present one selected-period Sync action. Automatically continue bounded work; a later Sync click handles interruption. While syncing, show an accessible full-screen blocker and prevent duplicate starts/date changes. On completion/failure, remove it and expose clear errors or the last successful Dashboard sync timestamp. This historical timestamp does not assert coverage of the current view; retain it after failures. Routine UI omits technical run diagnostics and manual Resume.
- Period navigation visibly shows a full Dashboard content skeleton until the new period is ready; never label old rows with new dates. Distinguish loading, invalid dates, empty results, failed reads, missing detail, and optional ETA failure.
- Omit zero-valued optional notices and empty Priority summaries. State each readiness fact once while retaining distinct lifecycle states. Supplied address text links safely to Google Maps without changing source data or destination precedence.
- Preserve drawer URL/history, focus containment/return, Escape, and one explicit order action. Use text-based status, labeled controls, keyboard/touch access, visible focus, and restrained announcements. Verify rendered tablet/phone, contrast, zoom, and reduced-motion behavior.

## Cross-Story Dependencies

Story 1.1 provides workload, period, landing, destination display, and order opening. Story 1.2 adds urgency and current task navigation. Stories 1.3 and 1.4 depend on 1.1 but remain independent of each other's provider work. Story 1.5 follows completed 1.1–1.4, applies the Subframe design handoff, and simplifies presentation while preserving their backend guarantees. Full rollout still requires measured performance acceptance and routing operational readiness; fixture evidence does not establish device, live-provider, or production behavior.
