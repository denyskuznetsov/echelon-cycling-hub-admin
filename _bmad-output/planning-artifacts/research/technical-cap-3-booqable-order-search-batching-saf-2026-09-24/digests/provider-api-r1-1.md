# Digest: Booqable public API capabilities relevant to CAP-3

Accessed 2026-09-24. Public documentation does not show a publication date.

- {claim: Booqable API v4 exposes POST /api/4/orders/search; the documented request accepts field selection, relationship includes, and page[number]/page[size]., source: https://developers.booqable.com/, publisher: Booqable, pub_date: unknown, accessed: 2026-09-24, confidence: high, class: api-capability}
- {claim: The Search orders section lists includes coupon, customer, properties, start_location, and stop_location; Fetch an order lists deeper includes including lines, line items, planning, stock_item_plannings, and stock items., source: https://developers.booqable.com/, publisher: Booqable, pub_date: unknown, accessed: 2026-09-24, confidence: high, class: response-completeness}
- {claim: Booqable v4 docs call the API beta and warn that non-backwards-compatible changes may be introduced., source: https://developers.booqable.com/, publisher: Booqable, pub_date: unknown, accessed: 2026-09-24, confidence: high, class: compatibility}
- {claim: Booqable documents HTTP 429 as Too Many Requests and says to slow down; docs do not specify a numerical limit or retry-after policy in the surfaced material., source: https://developers.booqable.com/, publisher: Booqable, pub_date: unknown, accessed: 2026-09-24, confidence: high, class: operational-limit}

## Leads / gaps

- No public guarantee located for response graph completeness for every order state or for a transactionally consistent snapshot between search and detail reads.
- No public request count, latency, or payload-size benchmark located that quantifies the savings or cost of this batching pattern.
- Requires authorized, sanitized local fixtures to compare normalized search graph with individual-detail graph; this run made no calls to a Booqable account.
