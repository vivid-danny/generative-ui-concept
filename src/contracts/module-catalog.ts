import { z } from 'zod'

import { ProductionTraitSchema, SelloutRiskSchema } from '@/contracts/market'
import {
    BADGE_IDS,
    DEAL_TREND,
    FAST_VELOCITY,
    NOTABLE_VIEWERS,
    RECENTLY_ANNOUNCED_DAYS,
} from '@/modules/production-list/badges'
import { CARD_SIGNAL_IDS } from '@/modules/production-list/card-signal'
import { STAT_IDS } from '@/modules/market-signals/signals'

/**
 * Module catalog.
 *
 * This file is the orchestrator's tool manifest as well as the renderer's
 * registry contract, which is why every `purpose` is written as one sentence
 * addressed to the model: "reach for this when...".
 *
 * The catalog is deliberately wider than what slice 1 renders. Modules carry an
 * `implemented` flag so later slices add a component without editing this
 * contract; the validator drops catalogued-but-unimplemented modules rather than
 * failing the whole spec.
 */

export const SizeSchema = z.enum(['hero', 'standard', 'compact', 'fixed'])
export type Size = z.infer<typeof SizeSchema>

export interface ModuleDefinition {
    readonly id: string
    /** Written for the orchestrator LLM: when should it reach for this module? */
    readonly purpose: string
    /** Which of the customer decision levers this module answers. */
    readonly lever: 'price' | 'date' | 'location' | 'seat_quality' | 'orientation'
    readonly sizes: readonly Size[]
    readonly defaultSize: Size
    /**
     * Which column the module renders in.
     *
     * Intrinsic to the module, not a prop the orchestrator sets. Choosing the
     * rail is choosing 340px, sticky positioning and desktop-only visibility —
     * that is form, and form does not belong in props (docs/COMPOSABILITY.md).
     * The renderer filters by it; see `ComposedPage`.
     */
    readonly region: 'main' | 'rail'
    readonly propsSchema: z.ZodTypeAny
    /**
     * The props, written for the orchestrator, in one short block.
     *
     * Deliberately hand-written and kept adjacent to `propsSchema` so drift
     * shows up in review. Without it the model was inventing prop names —
     * `sort_by` for `sort`, `budget_cap` for `filter.max_price` — because it
     * had never been shown the real API. Generate this from the schema instead
     * once there are enough modules that maintaining it by hand slips.
     */
    readonly propsHint: string
    /** Fields of the market snapshot this module needs to render at all. */
    readonly dataRequirements: readonly string[]
    /**
     * False for page chrome the LLM does not get to place — `event_header` is
     * always first. The validator strips these from any emitted layout.
     */
    readonly orchestrated: boolean
    /** False while the module is specified but has no component yet. */
    readonly implemented: boolean
}

/** Shared shape: a price/quality filter narrowing what a list module shows. */
const FilterSchema = z
    .object({
        max_price: z.number().positive().optional(),
        min_view_score: z.number().min(0).max(1).optional(),
        /**
         * One city, or the set of them a section is about.
         *
         * A list because "within a drive" is a set of cities and the model has
         * nothing else to say it with — see the note in `select.ts`. Exact
         * names, matched as given: a city with no dates simply contributes
         * nothing, the same as a single name that matches nothing.
         */
        city: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
        /**
         * The dimensions that turn a section heading into something real.
         *
         * "Likely to sell out" or "the shows everyone wants" were copy over an
         * unfiltered list until these existed — the orchestrator could name a
         * collection it had no way to actually assemble.
         */
        min_demand_score: z.number().min(0).max(1).optional(),
        min_value_score: z.number().min(0).max(1).optional(),
        min_sales_velocity: z.number().min(0).max(1).optional(),
        sellout_risk: SelloutRiskSchema.optional(),
        /** Only dates carrying this trait — e.g. the tour finale. */
        has_trait: ProductionTraitSchema.optional(),
        /**
         * Fri–Sun, or Mon–Thu. Derived from the date rather than stored, since
         * the calendar is not a property of the inventory — see
         * `src/orchestration/derive.ts`.
         *
         * Added because the eval brief said the visitor could travel "on a
         * weekend" and the orchestrator had no way to act on it: it could write
         * a heading about weekends over a list containing Wednesdays.
         */
        day_type: z.enum(['weekend', 'weeknight']).optional(),
        /** Soonest and furthest out, in days from the snapshot date. */
        max_days_out: z.number().int().positive().optional(),
        min_days_out: z.number().int().nonnegative().optional(),
    })
    .strict()

export const MODULE_CATALOG = {
    event_header: {
        id: 'event_header',
        purpose:
            'Orients the visitor: whose page is this and what are we looking at. Always rendered first and never placed by you.',
        lever: 'orientation',
        sizes: ['fixed'],
        defaultSize: 'fixed',
        region: 'main',
        propsSchema: z.object({}).strict(),
        propsHint: 'none — takes no props.',
        dataRequirements: ['performer.name', 'performer.image_url'],
        orchestrated: false,
        implemented: true,
    },

    production_list: {
        id: 'production_list',
        purpose:
            'Shows the actual dates this performer is playing, each with its own price floor and inventory. Reach for this whenever the visitor needs to pick between dates or cities — it is the default path to purchase on a performer page.',
        lever: 'date',
        sizes: ['hero', 'standard', 'compact'],
        defaultSize: 'standard',
        region: 'main',
        propsSchema: z
            .object({
                filter: FilterSchema.optional(),
                sort: z.enum(['date', 'price', 'value', 'demand']).default('date'),
                group_by_geo: z.boolean().default(true),
                /**
                 * How many rows this section shows.
                 *
                 * Capped by the section's prominence at validation time, not
                 * here — `hero` holds 3 and everything else 7
                 * (`STRUCTURAL_RULES.maxItemsBySize`). The schema stays wide
                 * because the ceiling depends on `size`, which is not visible
                 * from inside a props schema.
                 */
                max_items: z.number().int().min(1).max(20).default(7),
                /**
                 * The section's own heading, e.g. "Worth the drive".
                 *
                 * Required in practice whenever this module is placed more than
                 * once: several lists on one page are unreadable without a line
                 * saying what each one is. When absent, the module falls back to
                 * its built-in "N shows near X / all dates" headings.
                 */
                heading: z.string().min(1).max(60).nullable().default(null),
                /**
                 * Which badges this section may surface.
                 *
                 * An allowlist, not an instruction: a row shows a badge only if
                 * the badge is eligible here *and* true of that date. Naming
                 * `selling_fast` does not put it on every card — it puts it on
                 * the ones selling fast. Defaults to the two the page has always
                 * shown, so a section that says nothing looks unchanged.
                 */
                badges: z
                    .array(z.enum(BADGE_IDS))
                    .max(BADGE_IDS.length)
                    .default(['deals_available', 'tickets_left']),
                /**
                 * The signal in the slot beside each row's CTA.
                 *
                 * Enumerated rather than a boolean so the slot can hold a
                 * different fact later without renaming the prop or
                 * invalidating a stored composition. Section-level, like the
                 * badge allowlist — but unlike a badge it shows on every row,
                 * so it is the section saying "compare these on price
                 * movement", not a label a few dates happen to earn.
                 */
                card_signal: z.enum(CARD_SIGNAL_IDS).nullable().default(null),
                /**
                 * The page's one recommendation, and why — accepted here
                 * because this is where the model writes them.
                 *
                 * Only meaningful on a `hero` section: the validator lifts the
                 * pair onto the spec and drops a pick authored anywhere else.
                 * Declared loosely on purpose — the id is checked against the
                 * snapshot and the reason against its length and shape bounds
                 * during that lift, and rejecting either here would strip a
                 * recoverable pick before anything could report why.
                 */
                top_pick: z.string().nullable().optional(),
                top_pick_reason: z.string().nullable().optional(),
            })
            .strict(),
        propsHint: [
            'filter?: {',
            '    max_price?: number, min_view_score?: 0-1,',
            '    city?: exact city name, or an array of them — ["Milwaukee", "Detroit"]',
            '      Use the array to put a whole set of cities behind one heading. There is',
            '      no distance field, so this is how "within a drive" gets said: name the',
            '      cities you judge reachable. A heading that promises geography needs this,',
            '      not a sort order that happens to favour nearby dates.',
            '    min_demand_score?: 0-1     how much fans want this night',
            '    min_value_score?: 0-1      price against what you get',
            '    min_sales_velocity?: 0-1   how fast it is moving right now',
            '    sellout_risk?: "low" | "moderate" | "high"',
            '    has_trait?: "tour_opener" | "tour_finale" | "special_guest" | "hometown_show"',
            '    day_type?: "weekend" | "weeknight"   Fri-Sun, or Mon-Thu',
            '    min_days_out?, max_days_out?: integer days from today',
            '  }',
            '  A section is only really that collection if the filter says so — a',
            '  "likely to sell out" section wants `sellout_risk: "high"` behind it, not',
            '  just the words.',
            'sort: "date" | "price" | "value" | "demand"  (default "date")',
            '  "value" and "demand" sort by those scores, best first.',
            "group_by_geo: boolean  (default true; splits the visitor's own metro into its own group)",
            'max_items: integer  (default 7)',
            '  Capped by prominence: a `hero` section holds 3, any other holds 7. Asking',
            '  for more is not an error, it is just trimmed — but three dates read as a',
            '  recommendation and eight read as a list, so choose the count you mean.',
            'heading: string | null  (default null = use the built-in headings)',
            '  **60 characters.** Over that and the heading is dropped — and a section',
            '  placed more than once without one is dropped with it, so fourteen',
            '  characters too many can cost the whole band. Say what the section is, not',
            '  what it is not: "Where this tour gets loudest" fits, "Where this tour gets',
            '  biggest — for context, not all within budget or reach" does not, and the',
            '  caveat belongs in the dates rather than the heading.',
            'top_pick: production id | null       hero section only',
            'top_pick_reason: string | null       required whenever top_pick is set',
            '  The one date this page recommends, named on the section that recommends it.',
            '  It must be one of the three rows this hero actually shows — you write the',
            '  filter, so work out what it returns before you name a pick. A pick on any',
            '  other section is dropped.',
            'card_signal: null | one of                    (default null)',
            '    "price_trend"            "↓ 4% this week" — the same date, last week',
            '    "price_gap_to_cheapest"  "$18 over cheapest" — the other dates here',
            '    "typical_seat_price"     "Typical seat ~$210" — the rest of this date',
            '  The slot beside each row\'s "From $76" button, and its job is to give that',
            '  number a reference point. On its own the get-in price is one listing, often',
            '  the worst seat in the building: it does not say whether $76 is cheap for',
            '  this tour, cheap against the other dates shown, or anything about what a',
            '  seat someone would actually want costs. Each option answers a different',
            '  one of those, so pick the comparison this visitor needs.',
            '  Shows on every date in the section or none — that is what makes the rows',
            '  comparable, and it is why there is no "only where interesting" option.',
            'badges: array of, with what a date needs to qualify:',
            `    "deals_available"  price_trend_7d <= ${DEAL_TREND} (fell ${Math.round(Math.abs(DEAL_TREND) * 100)}%+ in a week)`,
            `    "selling_fast"     sales_velocity >= ${FAST_VELOCITY}`,
            '    "tickets_left"     sellout_risk is "high"',
            `    "fans_viewed"      fans_viewed_24h >= ${NOTABLE_VIEWERS.toLocaleString('en-US')}`,
            `    "newly_released"   announced_days_ago <= ${RECENTLY_ANNOUNCED_DAYS}`,
            '  (default ["deals_available", "tickets_left"])',
            '  An allowlist, not an instruction: a date shows a badge only if you',
            '  allowed it AND it qualifies. So allow what the dates in *this* section',
            '  qualify for — read their signals first. Two or three matched to the',
            '  section puts badges on most of its rows; two matched to the visitor but',
            '  not to these dates puts badges on none, and the section renders bare.',
            '',
            'You may place this module more than once to build sections — e.g. one',
            "filtered to the visitor's city, one for dates within driving range, one",
            'for the rest of the tour. Up to 3 instances. Every instance must then',
            'set `heading`, and should set `group_by_geo: false` so its own heading',
            'is the only one.',
        ].join('\n'),
        dataRequirements: ['productions'],
        orchestrated: true,
        implemented: true,
    },

    market_signals: {
        id: 'market_signals',
        purpose:
            "A compact read on the tour as a whole — what tickets cost, whether prices are moving, how much demand there is, how big the run is. Shown in the page's right rail beside the list, as supporting context: reach for it when a number about the tour would settle something the visitor is weighing, and never as the page's main argument. Its title and the wording of every stat are ours; what you choose is which facts appear and in what order, so pick the ones this visitor is actually weighing rather than all of them.",
        lever: 'orientation',
        sizes: ['fixed'],
        defaultSize: 'fixed',
        region: 'rail',
        propsSchema: z
            .object({
                /**
                 * Which stats appear, in order.
                 *
                 * One array rather than a pair, because where each stat sits on
                 * the card is form: the definition in `signals.ts` says whether
                 * a stat is a metric or a sentence, and the card puts each where
                 * it belongs. The model orders; the caps decide what survives.
                 */
                stats: z
                    .array(z.enum(STAT_IDS))
                    .min(1)
                    .max(5)
                    .default([
                        'fan_demand',
                        'lowest_price',
                        'selling_out',
                        'fans_viewing',
                        'tour_scale',
                    ]),
            })
            .strict(),
        propsHint: [
            'The card\'s title is fixed ("Event Trends") and not yours to set.',
            'stats: an ordered array of 1-5 of:',
            '    "fan_demand"          how much fans want this tour, as a level',
            '    "lowest_price"        the cheapest get-in price on the tour',
            '    "typical_price"       the median get-in price',
            '    "price_direction"     which way prices moved over the last week',
            '    "selling_out"         how many dates are selling out fast',
            '    "fans_viewing"        how many fans looked at these dates in the last day',
            '    "tour_scale"          how many dates, in how many cities',
            '    "tickets_available"   how much inventory exists across the tour',
            '  (default ["fan_demand", "lowest_price", "selling_out", "fans_viewing", "tour_scale"])',
            '  Order matters: earlier stats lead. Where each one sits on the card, and how',
            "  it is worded, is the card's decision — the one thing you choose here is",
            '  which facts appear and in what order. A stat with nothing behind it in this',
            '  snapshot is dropped, so naming one is a request, not a guarantee. Three or',
            '  four beats five.',
            '  The card always carries one demand reading and one price reading. Name the',
            '  ones this visitor is weighing; if you leave a category out, one is filled',
            '  in for you. So the choice is which, not whether.',
        ].join('\n'),
        dataRequirements: ['productions'],
        orchestrated: true,
        implemented: true,
    },

    // --- Specified, not yet implemented. ---
    //
    // `listing_preview` is the one wanted module still missing: it needs top
    // listings per event, which the snapshot does not carry, and it has to pair
    // with a chosen date rather than the tour. Six other entries were reviewed
    // and cut — `sellout_urgency`, `price_trend` and `date_compare` collapsed
    // into `market_signals`; `venue_alternatives` is covered by the list's geo
    // and city filters; `budget_entry` by the budget already arriving in the
    // context; and `view_from_seat_value` is seat-level detail, which is the
    // wrong stage of shopping for a page about choosing between dates.

    listing_preview: {
        id: 'listing_preview',
        purpose:
            'Shows a handful of real tickets for one date, filtered to what this visitor can actually use. Reach for this when the visitor has effectively already chosen a date and needs to see real seats and prices.',
        lever: 'seat_quality',
        sizes: ['standard'],
        defaultSize: 'standard',
        region: 'main',
        propsSchema: z
            .object({
                filter: FilterSchema.optional(),
                max_items: z.number().int().min(1).max(10).default(5),
            })
            .strict(),
        propsHint: [
            'filter?: { max_price?: number, min_view_score?: 0-1, city?: exact city name }',
            'max_items: integer 1-10  (default 5)',
        ].join('\n'),
        dataRequirements: ['listings_sample'],
        orchestrated: true,
        implemented: false,
    },
} as const satisfies Record<string, ModuleDefinition>

export type ModuleId = keyof typeof MODULE_CATALOG

export const MODULE_IDS = Object.keys(MODULE_CATALOG) as ModuleId[]

export function isModuleId(value: string): value is ModuleId {
    return value in MODULE_CATALOG
}

/** The modules the orchestrator is allowed to place, and that can render today. */
export const PLACEABLE_MODULE_IDS = MODULE_IDS.filter(
    (id) => MODULE_CATALOG[id].orchestrated && MODULE_CATALOG[id].implemented,
)

/**
 * Modules that constitute a path to purchase. At least one of these is required
 * in every layout — there is always a way to buy.
 */
export const PATH_TO_PURCHASE_MODULE_IDS = ['production_list', 'listing_preview'] as const
