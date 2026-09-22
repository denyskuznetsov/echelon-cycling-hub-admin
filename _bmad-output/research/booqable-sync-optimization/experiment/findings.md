# Read-only API experiment: batching is promising

The user authorized a small live API experiment after the initial research. This follow-up supersedes the initial report's no-live-calls limitation for this experiment only. No application implementation, database calls, sync invocation or provider mutations occurred. Twenty HTTP requests reached Booqable; earlier attempts failed during certificate verification. Credentials were read privately from existing configuration; payloads and order/customer identifiers were held in memory only. Saved results contain counts, timings and comparisons.

## What worked

- **Search can return detailed data for several orders together.** POST /api/4/orders/search with a simple comma-separated ID filter and the existing SOURCE_ORDER_INCLUDE returned three requested reserved orders plus their related records.
- Across those orders, all 31 line records, 30 planning records, referenced products/bundles/customers/coupon, and the one stock-item allocation/stock item matched the individual-read resource sets. Related resource objects matched too.
- Two of three per-order graphs matched exactly. The third had a difference in its primary order object; the probe did not persist field-level differences, so the cause is unresolved. Do not assume it is harmless ordering or a timestamp.
- A bounded date-filtered reserved-order list returned three rows, all inside the requested seven Madrid-day interval. This is positive compatibility evidence, not proof of complete enumeration, boundary correctness or Dashboard OR-query behavior.

## What did not work, or remains unknown

- GET /api/4/orders accepted the requested deep includes but returned only customers/coupon; all lines/plannings/products/allocations were absent. Splitting the same list into pages of one did not change this.
- The first search variant using nested OR conditions on IDs returned HTTP 400. A simple ID filter succeeded. The initial error body was discarded, so the rejection cause is unknown; this does not disprove documented date OR searches.
- Child listing endpoints returned all 31 expected lines and the one expected allocation for this sample. Lines included plannings but did not include requested products/deep allocations. Reconstructing complete snapshots through these endpoints would need additional work.
- Only reserved orders and one allocated stock item were sampled. No started/stopped, mixed fulfillment, many-allocation order, nested truncation, batch-search pagination, known independent inventory or concurrent edits were validated. Matching individual responses is regression parity, not independent completeness proof.
- Ordinary list pages had no top-level next link even when page-size-one requests returned subsequent orders. Never infer enumeration completion solely from a missing next link.

## What this means for the decision

Keep date filtering and cheaper result counting as the two accepted leading candidates. Move search-based bulk fetching from a documentation hypothesis to a promising, partially demonstrated option. It could replace several individual detail requests with one search request; this sample demonstrates three details in one response, not the safe batch size or end-to-end speedup.

The successful search took 487 ms in this run; its three immediately preceding individual baselines took 298, 303 and 523 ms. These single observations include uncontrolled network/server effects and are not a benchmark. There were no repeated trials or local database work. Do not extrapolate a production percentage or runtime.

Before implementation, the next bounded experiment should report only differing field paths for the unmatched order, compare normalized parser snapshots, exercise multiple allocated bikes and started/stopped orders, and force search pagination. An independently known fixture inventory or provider confirmation is still needed for completeness. Preserve lease-before-authoritative-read sequencing when considering bulk integration.

Evidence: result.json (12 requests) and followup-result.json (8 requests); reproducible probe scripts are stored alongside them. Do not rerun these live scripts as ordinary automated tests.
