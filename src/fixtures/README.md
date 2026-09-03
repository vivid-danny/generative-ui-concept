# Fixtures

## `market.json` — provenance

**This snapshot is hand-authored, not captured.** Source plan §5 defers real
snapshot capture, and slice 1 does not need listing volume, so the fixture was
written by hand to a plausible shape rather than scraped. Nothing here came off
vividseats.com.

That matters because the source plan (§3.2) distinguishes real inventory from
derived signals, and three planned modules read entirely from derived fields.
Until a real capture happens, treat every number below as illustrative:

| Field | Status in this fixture |
| --- | --- |
| `performer.*` | Real performer, invented ids. `image_url` points at a committed local asset under `/public/performers` — nothing is fetched from a CDN. |
| `performer.tour_name` | Invented tour name. Optional: the header and SEO copy fall back to a derived date-range line when it is absent. |
| `productions[].date/venue/city/state` | Real venues in plausible tour cities; dates chosen so the Chicago second night is 94 days out, matching the §3.1 context example. |
| `productions[].listing_count` | Invented, plausible magnitude. |
| `productions[].floor_price` / `median_price` | Invented. §3.2 says these should be real once a capture exists. |
| `productions[].sellout_risk` | **Fabricated** derived field. |
| `productions[].price_trend_7d` | **Fabricated** derived field. |
| `productions[].inventory_by_tier` | Computed from `listing_count` by fixed ratios. |
| `listings_sample[].view_score` / `deal_score` | **Fabricated** derived fields. |
| `listings_sample` | Unused in slice 1 — `listing_preview` is specified but not implemented. Present so the market contract is exercised in full. |

### One shape worth preserving

Indianapolis has the lowest `floor_price` while St. Louis has the lowest
`median_price`. That is deliberate: it keeps `highlight: "cheapest"` and
`highlight: "best_value"` pointing at *different* dates. When both pointed at
the same row, two distinct orchestrator choices rendered identically — which
made the composition look less responsive than it was. A real capture should be
checked for the same property.

## `contexts/*.json`

Three variants of one visitor. Everything except `stated_budget` is held
identical on purpose: the slice-1 claim is "same visitor, same inventory,
different budget → visibly different page", and any other varying field would
confound it.
