# Architecture seam review

Reviewed `ARCHITECTURE-SPINE.md` against `SPEC.md`, `data-contract.md`, the brownfield evidence and latest owner direction. Review scope is incompatible but individually compliant implementations, not implementation design expansion.

## Verdict

**Convergent with one narrow correction recommended before handoff.** The spine fixes the consequential task, time, sync and permission seams. The latest zero-task instruction is represented correctly: one highlight, without urgency or time escalation. No further product choice is needed for the finding below.

## Finding

### P2 — Associate each estimate with the delivery input it actually routed

**Location:** AD-8 and AD-9; related snapshot rule in AD-7.

The workload is loaded first, while the estimate adapter independently rereads the current order delivery inputs. The rules bind the provider request to the order ID, but do not bind the displayed estimate to the destination version/value. An order can change between those reads or an older request can complete after a revalidation.

Two compliant implementations can diverge: one attaches the result using only order ID and shows a duration for the newly changed address beside the old address; another discards it when the destination differs. Likewise, an older estimate can overwrite a newer destination's result. Both can obey the existing asynchronous provider and authorization rules.

**Minimal invariant:** An estimate is valid only for the origin/destination inputs used to compute it. Return sufficient input identity with the result, and display it only alongside matching delivery input; disregard stale or mismatched results. Exact fingerprints, transport fields and request-cancellation mechanics remain implementation choices. This does not require a persistent cache, new endpoint or product elicitation.

**Acceptance example:** Load address A, then update/revalidate the order to address B while A's estimate is pending. A's late result must not appear beside B. If the server rereads B while the workload still displays A, its result must not be presented as A's duration.

## Seams exercised without additional findings

- **Task scope:** AD-1 fixes assignment-instance ownership, open-instance predicate, task kind, cancellation exclusion, completed-task treatment and shared drawer membership. Seven current tasks cannot become eight through booked quantities or history.
- **Mixed states:** AD-5 prevents `total minus ready` from treating in-rental or storage work as preparation. The same status predicate feeds outgoing preparation totals. Completed tasks remain an explicit lifecycle count when current.
- **Zero tasks:** AD-5/6 preserve order visibility and one consistent label. Preparation thresholds expressly do not apply. The owner rejected additional zero-task severity states; the spine introduces none.
- **Time and read snapshot:** AD-2/3/4 settle order timestamps rather than cached task timestamps, directional duplication, inclusive Madrid date endpoints converted independently, one reference clock and a coherent aggregate snapshot.
- **Selected-period sync:** AD-10 fixes start-or-return discovery, local stale-candidate inclusion, identity deduplication, fixed-window resume and durable bounded progress. AD-11 prevents a failed/skipped candidate or incomplete enumeration becoming proven coverage; old scopes do not inherit new labels.
- **Shared drawer and permissions:** AD-7/12 retain direct Workshop access, staff-only task links, lazy detail loading, URL preservation and explicit direct-boundary authorization. The service-role exception is restricted to the existing authorized reconciliation worker.
- **Delivery fallback:** AD-8 fixes nonblank precedence and distinguishes absence from routing failure. AD-9 prevents viewport guessing and unsafe short-link resolution from silently producing a destination.
- **Deployment and performance:** Deferred configuration and measurement do not promise an unverified monthly-sync duration. Future schema/provider enablement retains local/hosted separation and explicit prerequisites.

## Non-findings deliberately left to implementation

SQL object names, DTO layout, visual highlight styling, batching sizes and exact timeout/concurrency values do not require new architecture choices provided the existing invariants and verification conditions hold. The review does not request a new service, migration, story or routing optimization.
