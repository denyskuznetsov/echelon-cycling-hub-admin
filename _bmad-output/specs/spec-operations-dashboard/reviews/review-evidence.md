# Evidence lens review

Date: 2026-09-22. Target: draft ARCHITECTURE-SPINE.md, AD-1 through AD-12. Static repository and public official documentation review only; no live tenant, database, credentials or application changes.

## Verdict

Pass with minor companion reconciliation. No blocking unsupported technology/provider commitment found. The principal product choices trace to explicit owner responses and append-only decisions. New execution guarantees are correctly specified as required extensions rather than existing behavior.

## Findings

1. **Minor: remove obsolete open-question wording from the build companions.** data-contract.md still says approximate duration availability “remain Q10” in its logical Delivery row and ends its old-coverage narrative with “Q11 must resolve coverage requirements.” brownfield.md C4/C5/C9 similarly retain pending wording. Later adopted-target sections and the spine resolve these questions, but a builder extracting an individual section could incorrectly reopen settled provider or eligibility choices. Retain historical evidence and label its former uncertainty explicitly; refer to AD-2/9/10 for the adopted target. This is document consistency, not a missing owner decision.
2. **Implementation prerequisite, already deferred: address ambiguity detection is not provided simply by asking Compute Routes for duration.** Google documents that address inputs may internally search/disambiguate and resolve unexpectedly. AD-9 correctly makes ambiguity verification a prerequisite and forbids guessing; implementers must preserve that gate rather than assume every successful route proves the intended destination. No additional provider or geocoding integration is adopted in this review. Unsupported destinations must remain unavailable until verified. [Official waypoint guidance](https://developers.google.com/maps/documentation/routes/specify_location).

## Evidence checks

| Rule | Evidence and result |
| --- | --- |
| AD-1 current-task scope | Owner explicitly adopted reconciled task ownership and accepted 7/7 without source quantity audit. Foundation migration `20260821120000_workshop_foundation.sql` has assignment `closed_at`, unique assignment/task-kind, and `rental_turnaround`; completion changes status without closing assignment (storage command near line 1143). Source-apply closes removed assignment instances. Thus active-assignment/noncancelled predicate and completed inclusion are coherent; do not reuse queue default which excludes completed. |
| AD-2 eligibility | Owner explicitly approved reserved/started/stopped, excluded draft/new/canceled/archived, retained absent order numbers. Actual integration column is `orders.booqable_order_id` (base migration line 317), matching spine. This corrects the earlier conversational `booqable_id` shorthand. |
| AD-3/4 database/date boundary | Owner accepted one PostgreSQL read function; repository rule requires SQL aggregation. Invoker permissions and shared-clock/DST constraints are architecture requirements, not claims that a new function exists. |
| AD-5/6 lifecycle/highlighting | User approved mixed stage counts, storage-stage visibility, 6h/2h today-only preparation thresholds and expressly rejected urgency on absent tasks. Latest memlog entry preserves that rejection. No extra zero-task state is introduced. |
| AD-7 navigation | Owner accepted shared current-task links, Dashboard first plus Workshop retained, and default staff landing with deep-link preservation. Distinguishing partner drawer access from staff task data is supported by existing permission boundary. |
| AD-8 delivery | Owner expressly selected delivery_address then maps_link_order, no billing fallback. Existing map field persistence is documented in its migration and brownfield evidence. |
| AD-9 provider | Owner selected Google and delegated engineering details. Official location docs accept address/place ID/coordinates; arbitrary Maps URL is not a waypoint. TRAFFIC_UNAWARE explicitly omits live traffic; it still uses average time-independent conditions. Google policy restricts caching and requires attribution, so no persisted/cross-request result caching is conservative and supported. Real URL resolution remains correctly unverified. BUSINESS_ADDRESS exists in `src/ui/layouts/brand-assets.ts:7`. |
| AD-10 sync | Current `manual-sync.ts` enumerates reserved pages and awaits per-order reconciliation; start/resume go through user RPC then service-role worker. Fixed period, persisted discovery and selected-status OR-date semantics are future requirements, not existing capabilities. Booqable v4 public reference supplies order search; spine wisely binds selection semantics rather than assuming an unverified combined HTTP query or bulk snapshot endpoint. |
| AD-11 evidence | Existing completion/cursor/result infrastructure supports reuse, but newly required fixed-window success must be implemented. Spine explicitly preserves old scope meanings and does not promise atomic vendor completeness. |
| AD-12 permissions | Owner explicitly approved narrow existing-worker exception. Sync migration contains staff checks (`get_user_role`, admin/manager/mechanic). No privileged Dashboard reads are permitted. |
| Baseline versions | package.json directly pins Next 16.3.1, React 19.2.8 and TypeScript 5.9.3. Spine labels these installed baseline, not researched upgrade choices. No unverified hosted PostgreSQL version is asserted. |

## Official sources inspected

- [Google Routes locations](https://developers.google.com/maps/documentation/routes/specify_location): location input forms and internal address ambiguity.
- [Google routing preference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RoutingPreference): no-live-traffic semantics.
- [Google Routes policy](https://developers.google.com/maps/documentation/routes/policies): caching restrictions, attribution and applicable EEA terms must be checked.
- [Booqable v4 reference](https://developers.booqable.com/v4.html#search-orders): published API generation and search reference. No live request or complete multi-order snapshot validation.

The Google policy page also requires applicable user-facing terms/privacy treatment; the spine already lists billing-account terms/privacy notices as routing rollout prerequisites. No additional architecture blocker is introduced by this review.
