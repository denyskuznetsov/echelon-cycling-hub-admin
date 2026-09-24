# Booqable sync: retained research summary

The feature spec is the current contract: [SPEC.md](../../specs/spec-optimize-booqable-sync/SPEC.md). It includes date filtering, cheaper result counting and batching only if verification passes. No application implementation is authorized by this research/spec work.

## Findings that changed the decision

- The current seven-day sync lists all reserved orders, filters dates locally and records even skipped rows. Filter upstream, while also rechecking locally eligible IDs so moved/cancelled orders do not stay stale.
- Orders are processed sequentially. A successful order normally uses five DB RPCs plus provider reads, excluding run/renewal overhead.
- Result recording replaces the latest run/order outcome, then recounts the entire growing result set. Preserve retry correctness while reducing repeated work in PostgreSQL.
- Initial seven-day sync walks all pages in one action; v1 resume stores page/scope/run ID, not a frozen period or per-order checkpoint. Preserve recovery, and resolve required scope metadata during design.
- The live experiment found that ordinary GET order lists omit the required detailed relationships, but POST order search can return them for multiple IDs. Two sampled orders matched fully; one primary order differed for an unknown reason. Only one bike allocation was sampled.

## Evidence and limits

Code baseline: fb5dea705bf58dd14af964e872073e8f4aba4108. Source locations, safety constraints, retry semantics and deferred options are preserved in the spec companions. No local DB profiling or end-to-end sync benchmark was run.

The [experiment findings](experiment/findings.md), two probe scripts and compact JSON results retain the actual read-only evidence. JSON formatting was reduced without changing any values. No raw customer payloads or credentials are saved. Do not run live scripts as automated tests.

Public sources: [Booqable v4](https://developers.booqable.com/v4.html), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration), [Supabase timeouts](https://supabase.com/docs/guides/database/postgres/timeouts), accessed 2026-09-22. Their publication dates were unavailable. Recheck provider guarantees and actual deployment limits before implementation.

Documentation supports date search; tenant quota/page caps, child-change timestamp propagation and complete bulk graph guarantees remain unestablished. Measured request timings were single observations, not a speedup estimate. Detailed acceptance checks are in the spec's verification companion.

Concurrency, autonomous background jobs and timestamp-based incremental refresh were research options, not accepted scope. Their safety conditions remain in verification.md so later work cannot mistake them for approved requirements.
