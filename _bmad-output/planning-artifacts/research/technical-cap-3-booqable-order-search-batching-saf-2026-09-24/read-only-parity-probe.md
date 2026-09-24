# CAP-3 read-only parity probe

Date: 2026-09-24

## Safety boundary

Ran 30 authenticated, TLS-verified Booqable API requests: only `GET` order list/detail routes and `POST /api/4/orders/search`, which is used here as a retrieval/search operation. No Booqable write, sync/reconciliation flow, production database, or migration was invoked. Raw payloads, order IDs, customer values, and credentials were kept out of saved output. Saved evidence is limited to resource counts, request counts/statuses, and changed field paths.

## Method

For each of `reserved`, `started`, and `stopped`, selected the first two orders returned by a status-filtered read (six convenience-sample orders total). Fetched each through the existing detailed-order GET include path, then compared against a combined search response for the same two IDs. A first probe also repeated each two-order search with page size one across two pages. A second pass parsed detail and combined search payloads with the application's actual `parseSourceOrderSnapshot` function using the same fixed `fetchedAt` value.

## Results

- All 30 HTTP responses were 200; no retry was needed.
- Each combined search returned exactly the two requested IDs for each status group.
- For all six orders, the existing application parser accepted both the detail and search payloads and produced the same line and assignment contents after sorting those arrays by stable IDs.
- Four of six parser snapshots matched byte-for-byte in array order. Two differed only in the order of the parsed `lines` array (`lines` was the only changed snapshot path); their line and assignment contents matched after sorting.
- Search results split into two page-size-one pages also matched each order's detail graph exactly for these six cases.
- The sample included orders with up to four stock-item assignments. It did not establish partner-unit behavior, an intentionally mixed-fulfillment fixture, or behavior at the production batch size.

## What this proves—and what it does not

This is useful evidence that the current tenant's search endpoint can return the fields consumed by the existing snapshot parser for these six sampled orders, including started and stopped examples. It also identifies a real consistency detail: combined results can change line-array order even when the line and assignment contents match. CAP-3 must either preserve/normalize ordering safely or demonstrate that ordering cannot affect application behavior.

This does not prove that detail responses are an independent ground truth, that the provider always returns every relevant child record, that searches remain complete as orders change, or that this behavior is guaranteed by Booqable. The sample came from the first two rows per status, not an independently inventoried fixture set. The public API documentation lists narrower search includes than the nested graph observed here. The API describes itself as beta. No speedup claim follows from this parity run.

## Next evidence needed

1. Compare against independently known order contents (a controlled fixture inventory) and include partner units, multiple allocations, and mixed states.
2. Test beyond two orders per page and through the real candidate counts, including pagination termination and duplicate/missing IDs.
3. Resolve whether line ordering affects source application or fingerprints; add explicit stable ordering only if it preserves current semantics.
4. Ask Booqable to confirm whether nested line/planning/allocation includes on `POST /orders/search` are supported, since they are not in the documented search include list.
5. Keep lease-before-fetch, per-order atomic apply, and individual detail fallback as CAP-3 requirements.
