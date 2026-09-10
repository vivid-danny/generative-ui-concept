import { z } from 'zod'

import { ProductionTraitSchema, SelloutRiskSchema } from '@/contracts/market'
import { BADGE_IDS } from '@/modules/production-list/badges'
import { CARD_SIGNALS } from '@/modules/production-list/trend'
import { STAT_IDS } from '@/modules/market-signals/signals'

/**
 * Module catalog — source plan §3.3.
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
    /** Which of the customer decision levers (§1) this module answers. */
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
     * always first (§4). The validator strips these from any emitted layout.
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
        city: z.string().optional(),
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
                highlight: z.enum(['best_value', 'cheapest', 'soonest']).nullable().default(null),
                group_by_geo: z.boolean().default(true),
                max_items: z.number().int().min(1).max(20).default(8),
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
                card_signal: z.enum(CARD_SIGNALS).nullable().default(null),
            })
            .strict(),
        propsHint: [
            'filter?: {',
            '    max_price?: number, city?: exact city name, min_view_score?: 0-1,',
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
            'highlight: "best_value" | "cheapest" | "soonest" | null  (default null)',
            'group_by_geo: boolean  (default true; splits the visitor\'s own metro into its own group)',
            'max_items: integer 1-20  (default 8)',
            'heading: string | null  (default null = use the built-in headings)',
            'card_signal: "price_trend" | null  (default null)',
            '  A signal in the slot beside each row\'s price, e.g. "↓ 4% this week". Shows',
            '  on every date in the section or none — reach for it when this visitor is',
            '  weighing when to buy rather than which date.',
            'badges: array of ["deals_available" | "selling_fast" | "tickets_left" |',
            '  "fans_viewed" | "newly_released"]  (default ["deals_available", "tickets_left"])',
            '  An allowlist, not an instruction: a date shows a badge only if you',
            '  allowed it AND it is true of that date. Allow two or three that match',
            '  what this visitor is weighing, not every one that happens to be true.',
            '',
            'You may place this module more than once to build sections — e.g. one',
            'filtered to the visitor\'s city, one for dates within driving range, one',
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
            'A compact read on the tour as a whole — what tickets cost, whether prices are moving, how much demand there is, how big the run is. Shown in the page\'s right rail beside the list, as supporting context: reach for it when a number about the tour would settle something the visitor is weighing, and never as the page\'s main argument. Its title and the wording of every stat are ours; what you choose is which facts appear and in what order, so pick the ones this visitor is actually weighing rather than all of them.',
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
                    .default(['fan_demand', 'lowest_price', 'selling_out', 'fans_viewing', 'tour_scale']),
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
            '  it is worded, is the card\'s decision — the one thing you choose here is',
            '  which facts appear and in what order. A stat with nothing behind it in this',
            '  snapshot is dropped, so naming one is a request, not a guarantee. Three or',
            '  four beats five.',
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
 * Modules that constitute a path to purchase. Source plan §3.4 requires at least
 * one of these in every layout — there is always a way to buy.
 */
export const PATH_TO_PURCHASE_MODULE_IDS = ['production_list', 'listing_preview'] as const
