# Architecture spine rubric review

Reviewed: 2026-09-22. Target: `ARCHITECTURE-SPINE.md` (draft). Lens: the bmad-architecture good-spine checklist. Static documentation and targeted repository checks only; no runtime, hosted data, migrations or provider calls.

## Verdict

Pass with one small clarification before finalization. The spine fixes the feature's real divergence points, preserves the adopted product decisions, and covers its operational envelope without expanding into a new platform or task-creation mechanism. No critical or high findings.

## Findings

### R1 — Medium — State the date restriction on locally seeded sync candidates explicitly

AD-10 scopes source discovery to the selected period, then adds “plus locally eligible orders captured at run start.” AD-2 defines eligibility and directional date membership separately. One implementation could seed only locally eligible orders starting/returning in the selected window; another could read every locally eligible reserved/started/stopped order regardless of dates. Both can cite the present AD-10 wording. The latter widens vendor work unexpectedly, particularly problematic given the reported sync slowness.

**Disposition: autofix.** State that the local seed consists of orders meeting AD-2 status eligibility AND having a start OR return in the saved selected interval at run start. Once captured, retain and refresh those IDs even when their authoritative source status/date moves outside the window. This does not need another product choice.

## Checklist assessment

| Dimension | Assessment |
| --- | --- |
| Real divergence points | Covered: task denominator, current/history predicate, status membership, snapshot/count coherence, dates, lifecycle presentation, address precedence, routing isolation, recovery scope and confidence, permissions. R1 is the sole wording gap identified. |
| Enforceable AD rules | Each AD has Binds/Prevents/Rule and concrete verification consequences. Exact SQL/DTO names are correctly left to implementation. Multiple Rule bullets in AD-9/10/12 remain coherent within their boundaries. |
| User-adopted behavior | Latest zero-task decision is correctly represented as one consistent highlight with no urgency/escalation. Normal preparation thresholds remain. Mixed storage stages, task ownership, selected-period refresh, staff landing and direct Workshop navigation match the conversation. |
| Feature altitude | Appropriate. No whole-application redesign, new service, story breakdown or new state machine. The service-role exception is explicitly narrow and owner-approved. |
| Brownfield fit | Fits the existing drawer, local order UUID navigation, order-centric read need, trusted role and reconciliation seams. Targeted checks confirm `orders.booqable_order_id` and existing `fulfillment_type`; the earlier conversational identifier shorthand has not leaked into the spine. |
| Parent versus sibling | Correctly identifies the Workshop spine as a sibling and preserves implemented invariants without adopting obsolete recovery scope as a binding parent decision. |
| Capability coverage | CAP-1 through CAP-8 have explicit ownership and AD mapping; outgoing/incoming and zero-task coverage are present. Parent is reconciling companion files concurrently, so stale historical companion wording is not treated as a final spine defect. |
| Deferred choices | Performance numeric targets, bounded execution configuration, live URL fixtures and provider rollout prerequisites can be deferred without changing the fixed behavior. Unsupported routes already have an explicit unavailable result. Product changes such as range limits still require approval. |
| Technology evidence | Existing versions are recorded as repository baseline, not a proposed upgrade. External provider/function/RLS sources and verification limits are identified. No claim of measured runtime speed, live provider correctness or deployed schema parity is made. This review did not independently repeat the author's web checks. |
| Operational envelope | Covered: environment gate, server credentials/quotas, logs, bounded work/resume, local-only schema verification and CI deployment, old run compatibility, rollback of entry points and preservation of history. |
| Security boundary | Explicit direct-role checks, SECURITY INVOKER plus RLS, staff-only drawer task data, narrow privileged worker exception and non-public routing adapter prevent the relevant incompatible implementations. |

## Finalization notes

- Apply R1, finish the companion reconciliation already underway, run the deterministic lint, and mark the spine final only after the remaining reviewer lenses are resolved.
- Q14 is a rollout performance-acceptance item, not a missing product decision necessary to hand this architecture to an implementing developer.
- No additional owner question is required by this review.
