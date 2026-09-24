---
title: 'Technical research: CAP-3 Booqable order search batching safety'
type: technical
topic: 'CAP-3 Booqable order search batching safety'
decision: 'Should CAP-3 add batched Booqable order reads, and under what safe fallback and acceptance conditions?'
source: native web research
status: complete
preset: standard
validation: normal
created: 2026-09-24
updated: 2026-09-24
---

# Technical research: CAP-3 Booqable order search batching safety

**Decision this research serves:** Should CAP-3 add batched Booqable order reads, and under what safe fallback and acceptance conditions?

## Executive summary

Booqable's public API supports order search and pagination, but its published search includes do not promise the full nested graph CAP-3 needs. A follow-up read-only probe compared six live orders against the app's existing detail path: all six parsed snapshots matched after ignoring line-array order, but two differed in that order. This is promising parity evidence for sampled orders, not proof of completeness. Keep individual detail reads as the safety baseline until CAP-3 passes the broader fixture and safety gates below. [1][4]

No production database was accessed and no Booqable data was changed. The initial recon used public documentation only; the follow-up used 30 read-only Booqable API requests under a strict request cap. Raw responses and identifiers were not retained.

## Scope and safety boundary

Research is limited to public documentation and read-only evidence. No production database access, Booqable account/API calls, or changes to Booqable data were made. Public documentation does not by itself establish completeness/parity for this integration's order graph; CAP-3 therefore requires local, sanitized fixtures or other authorized non-production evidence.

## Findings: API capability and limits

Booqable v4 exposes `POST /api/4/orders/search`. Its documented parameters include field selection, relationship includes, and pagination (`page[number]`, `page[size]`). [1] The API documentation labels v4 as beta and warns that breaking changes may be introduced. [2] Booqable also documents HTTP 429 as “Too Many Requests” and instructs clients to slow down, but the public docs reviewed do not give a numeric rate limit or retry-after contract. [3]

The search endpoint documents includes for coupon, customer, properties, and start/stop locations. Individual order fetch documents a broader nested graph: lines, items, planning, stock-item-plannings, and stock items. The documented search includes therefore do not establish that search can return the line and allocation graph CAP-3 needs. The API documentation also does not promise that search and detail results form a consistent snapshot while an order changes. [1]

**Interpretation:** Search batching can reduce request count only if the required set fits in the returned page(s), and the normalized batch graph is complete enough to replace each detail response. With `N` candidate orders and `K` search pages covering them, the request reduction is `N - K` before fallback reads. This arithmetic is not a provider performance claim. Larger includes also make payloads larger, and 429 handling plus request count alone cannot demonstrate a runtime win.

## Recommendation

Keep individual detail reads as the correctness baseline. Enable batching only when all of these gates pass on authorized, sanitized non-production fixtures:

1. **Scope and identity parity:** the batch result contains exactly the expected candidate IDs for the frozen server-side scope; no duplicates or missing IDs. Pagination is fully traversed, with termination and page-count checks.
2. **Graph parity:** normalize and compare every field consumed by parsing/source-apply from batch and detail responses, including lines, planning allocations, stock-item identities, partner units, reassignment, and reserved/started/stopped/mixed lifecycle cases. Missing, null, empty, truncated, or unknown relationship shapes fail closed.
3. **Freshness safety:** preserve the existing lease-before-fetch and fencing behavior. Before applying a batch result, reject ambiguous/stale evidence and use the established individual authoritative read path for affected orders. A batch response must never weaken atomic per-order apply or retryability.
4. **Measured benefit:** demonstrate fewer Booqable requests on representative fixture sets, including multi-page sets, without increasing failures, incomplete results, or unacceptable payload/processing cost. No production or tenant-performance claim follows from the public docs.
5. **Runtime fallback:** on unsupported includes, pagination ambiguity, malformed/partial graphs, 429, or parity uncertainty, fall back to individual detail reads where safe; preserve surfaced result accounting. Avoid an unbounded retry loop. Validate retry timing and alerting policy against Booqable's current API behavior during implementation.

Because the provider does not document completeness or snapshot semantics, passing a few simple fixtures is insufficient to turn batching on broadly. The current probe and its exact limits are recorded in [read-only-parity-probe.md](read-only-parity-probe.md). If a meaningful fixture matrix or reliable fallback cannot be established, retain individual reads.

## Open questions

- Does the live v4 search implementation honor the required nested `include` graph for all relevant order lifecycle states and paginate all matching results without truncation? The follow-up probe tested two examples per status only; broader, independently known fixtures are still needed. [4]
- When an order changes during search/detail fetch, what consistency behavior is observed? Public docs do not answer this. Use a controlled non-production experiment only if authorized; compare `updated_at` and graph identity around the read, and continue to rely on current lease/fencing rules.
- What are the actual payload and latency tradeoffs for the planned page size? Public docs provide no benchmark; measure locally against fixtures, not production.

## Source appendix

| Ref | Claim supported | Publisher | Publication date | Accessed | Confidence |
|---|---|---|---|---|---|
| [1] | v4 search parameters, pagination and documented search/fetch includes | [Booqable API v4 documentation](https://developers.booqable.com/) | Not stated | 2026-09-24 | High for documented statements |
| [2] | Beta warning and possible breaking changes | [Booqable API v4 documentation](https://developers.booqable.com/) | Not stated | 2026-09-24 | High for documented statements |
| [3] | HTTP 429 meaning and slow-down instruction | [Booqable API v4 documentation](https://developers.booqable.com/) | Not stated | 2026-09-24 | High for documented statements |
| [4] | Six-order response and application-snapshot parity observations, with the exact probe limits | [CAP-3 read-only parity probe](read-only-parity-probe.md) | 2026-09-24 | 2026-09-24 | High for these sampled requests only |

## Staleness map

The API compatibility warning is the fastest-aging claim; re-check before implementation and again before enabling batching. The documentation gives no publication date, so the claims ledger cannot assign a reliable age from publication date.
