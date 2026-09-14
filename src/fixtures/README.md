# Fixtures

## `market.json` — provenance

**This snapshot is hand-authored, not captured.** Source plan §5 defers real
snapshot capture, and slice 1 does not need listing volume, so the fixture was
written by hand to a plausible shape rather than scraped. Nothing here came off
vividseats.com.

The tour is a full ~52-date run (matching Olivia Rodrigo's actual tour length) so
the orchestrator has real variety to compose around — a range of cities, weeknights
and weekends, lead times, price tiers, and demand. The first seven productions
(`prod-001`…`prod-007`) are the original slice-1 anchors, unchanged in their
inventory/price fields; the rest were appended.

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
| `productions[].inventory_by_tier` | Computed from `listing_count` by fixed ratios (~0.12 / 0.67 / 0.05). |
| `productions[].demand_score` | **Fabricated** derived field. 0–1 fan anticipation, independent of price/inventory. |
| `productions[].sales_velocity` | **Fabricated** derived field. 0–1 rate of sale, finer than `sellout_risk`. |
| `productions[].value_score` | **Fabricated** derived field. 0–1 price-for-demand value at the date level. |
| `listings_sample[].view_score` / `deal_score` | **Fabricated** derived fields. |
| `productions[].fans_viewed_24h` | **Fabricated.** A real count, not a score, because the badge says "20 Fans Viewed" and a number on screen has to be a number in the data. Correlated with `demand_score` so the two hang together. |
| `productions[].traits` | **Fabricated.** What is notable about a night — `tour_opener`, `tour_finale`, `special_guest`, `hometown_show`. Enumerated, because a trait makes a claim about the event. The tour opens in Chicago and closes on an LA hometown night; five dates carry a named opener. |
| `productions[].announced_days_ago` | **Fabricated.** Per production, not per visit — five cities are late additions (2–6 days) against a tour announced 3–6 weeks ago, so "Newly Released" means something on some cards and not others. |

The three new signals (`demand_score`, `sales_velocity`, `value_score`) are carried
over from the earlier `event-decision` prototype's per-event `demand` /
`salesVelocity` / value model. They are stored, not computed, so the orchestrator
and future modules read them directly. Day-of-week and lead time are **not** stored
— derive them from `date` + `captured_at` via `src/orchestration/derive.ts`.
| `listings_sample` | Unused so far — `listing_preview` is specified but not implemented. Present so the market contract is exercised in full. |

Nothing in the snapshot is tour-level. `market_signals` reads its whole
vocabulary off `productions` — minima, medians, means, counts and city sets — so
adding a card meant adding no data. Two figures from that card's Figma frame
were dropped rather than fabricated: "tickets sold in the last 24 hours" (no
sales-volume field, and a tour-wide constant would be identical for every
visitor) and "343 fans shopping now", which was hardcoded in `PerformerRail`
and is now the summed `fans_viewed_24h`.

### Shapes worth preserving

Indianapolis has the lowest `floor_price` while Chicago's 12/05 has the lowest
`median_price`, and neither is the best `value_score`. That is deliberate. It
was originally about keeping `highlight: "cheapest"` and `"best_value"` on
different rows; those enums are gone, but the property matters more now, not
less — a model-named `top_pick` is only interesting if the date it recommends can
differ from the obvious one. If cheapest, best value and most in demand all
collapse onto the same row, every recommendation looks like the same
recommendation. A real capture should be checked for the same property.

**The spread between `floor_price` and `median_price` varies by date, and that
is load-bearing.** It used to be a near-constant multiple — 2.05 to 3.19,
standard deviation 0.18 — because the generator multiplied rather than because
anyone decided tour pricing works that way. A constant ratio makes
`typical_seat_price` a restatement of the number already in the button, so the
signal looks informative and says nothing. The multiples now run **1.30 to
3.20**, standard deviation 0.54, on this read: the higher the demand, the
*narrower* the spread, because on a marquee night the cheap end has already been
bought and the surviving floor price is already a real seat; on a quiet night the
upper deck is wide open and the floor price is a genuine nosebleed. Five named
exceptions break the correlation with `demand_score`, because a signal that just
restates demand is not worth a slot:

| Date | Adjustment | Why |
| --- | --- | --- |
| `prod-004` Indianapolis | +0.45 | Deep unsold upper deck on a quiet night — the widest spread on the tour, and why the cheapest get-in is not the cheapest seat. |
| `prod-052` LA, Kia Forum | +0.75 | A marquee night that bucks the base read: enormous cheap inventory still unsold. |
| `prod-027` Palm Springs | −0.85 | A small room priced alike throughout, despite low demand. |
| `prod-005` St. Louis | −0.55 | Honest pricing on a cheap date. |
| `prod-013` Memphis | −0.30 | Same, less pronounced. |

The script that applied this lives at `.context/gen-spread.mjs`, which is
git-ignored like `gen-market.mjs` — the table above is the durable record.

A few dates are authored as deliberately interesting orchestration cases: a couple
of cheap weeknight "hidden gems" with high demand and high `value_score` (e.g.
Memphis, Oklahoma City), premium marquee nights that are hot but poor value
(NYE Philadelphia, Las Vegas, LA, MSG — high `demand_score` / `sales_velocity`,
low `value_score`), and mid-market weekends that are unremarkable on every axis.

### Authoring invariants (the test suite pins these — preserve on any edit)

- The global-minimum `floor_price` is a **non-Chicago** date (Indianapolis $54) and
  is a **different date** than the minimum `median_price` (Chicago 12/05, $123),
  so the cheapest get-in and the cheapest typical seat are never the same row
  (`select.test.ts`, `card-signal.test.ts`).
- **The get-in ordering inverts against the typical-seat ordering on at least one
  pair.** Indianapolis is `From $54 · Typical seat ~$175`; Chicago 12/05 is
  `From $76 · Typical seat ~$125`. The button column and the signal column
  disagree about which date is cheaper, which is the entire reason
  `typical_seat_price` exists — remove the inversion and the signal becomes
  decoration (`card-signal.test.ts`).
- Every date has `median_price > floor_price`, and the multiple stays inside
  1.3–3.2 (`card-signal.test.ts`).
- At least one **Chicago** date sits within the 20 lowest floor prices, and Chicago
  floors are not the global minimum, so geo-grouping visibly lifts the metro above a
  price sort (`select.test.ts`).
- Some dates ≤ $80 and some > $80 (currently 15 under $80), so the budget filter
  leaves a non-empty proper subset (`select.test.ts`, `validate.test.ts`).
- The **8 earliest-by-date** productions all have `floor_price` ≤ $250, because the
  budget-250 spec shows the 8 earliest with no price filter and the eval asserts
  none exceed budget. Ultra-premium dates are later in the calendar.
- `prod-002` (Chicago, 2026-12-05) stays 94 days out from `captured_at`.
- The rail card's figures are pinned to the fixture in `signals.test.ts`: mean
  `demand_score` **0.736** (reads "High"), min `floor_price` **$54**, median
  `floor_price` **98.5** ("$99"), mean `price_trend_7d` **−0.0063** ("Easing"),
  **19** dates at high sellout risk, `fans_viewed_24h` summing to **121,821**,
  `listing_count` to **59,564**, and **52** dates across **36** cities. An edit
  that shifts a mean across a band boundary changes what the card says, which is
  why the bands are asserted rather than the raw numbers alone.

The generator that produced the tour and checked these invariants is at
`.context/gen-market.mjs` (gitignored) if the fixture needs regenerating.

## Precomputed specs — hand-refreshed for the expanded market

The three specs in `src/orchestration/specs/leah-onsale-*.json` were originally
composed by Claude for the 7-date snapshot. Growing the market made their prose
factually stale (old floor-price figures) and, for budget-80, made the composition
hide the reachable Chicago night. They were **hand-refreshed this session** (prose
updated to match the 52-date market; budget-80 `max_items` raised 6 → 12 so the
$76 Chicago date is visible again). Their provenance reflects this: `model` reads
`hand-authored`, `prompt_version` is `v2`. This is an interim measure — they should
be **regenerated for real** via the Stage-3 live orchestration bridge once it is
available, restoring genuine model provenance.

## `contexts/*.json`

Three variants of one visitor. Everything except `stated_budget` is held
identical on purpose: the slice-1 claim is "same visitor, same inventory,
different budget → visibly different page", and any other varying field would
confound it.
