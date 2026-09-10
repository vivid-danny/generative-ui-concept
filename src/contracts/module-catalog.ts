import { z } from 'zod'

import { BADGE_IDS } from '@/modules/production-list/badges'

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
        propsSchema: z
            .object({
                filter: FilterSchema.optional(),
                sort: z.enum(['date', 'price', 'value']).default('date'),
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
            })
            .strict(),
        propsHint: [
            'filter?: { max_price?: number, min_view_score?: 0-1, city?: exact city name }',
            'sort: "date" | "price" | "value"  (default "date"; "value" is lowest typical price)',
            'highlight: "best_value" | "cheapest" | "soonest" | null  (default null)',
            'group_by_geo: boolean  (default true; splits the visitor\'s own metro into its own group)',
            'max_items: integer 1-20  (default 8)',
            'heading: string | null  (default null = use the built-in headings)',
            'badges: array of ["deals_available" | "selling_fast" | "tickets_left" |',
            '  "fans_viewed" | "newly_released"]  (default ["deals_available", "tickets_left"])',
            '  Which signals this section may surface. An allowlist, not an instruction:',
            '  a date shows a badge only if you allowed it AND it is true of that date,',
            '  so naming "selling_fast" marks the dates selling fast, not all of them.',
            '  Choose by what this visitor is weighing — value signals for a',
            '  price-sensitive browse, "fans_viewed" for someone chasing the big night,',
            '  "tickets_left" where running out is the real risk. Two or three is plenty;',
            '  allowing all five makes every row noisy.',
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

    // --- Specified, not yet implemented. Slice 2 onward. ---

    listing_preview: {
        id: 'listing_preview',
        purpose:
            'Shows a handful of real tickets for one date, filtered to what this visitor can actually use. Reach for this when the visitor has effectively already chosen a date and needs to see real seats and prices.',
        lever: 'seat_quality',
        sizes: ['standard'],
        defaultSize: 'standard',
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

    venue_alternatives: {
        id: 'venue_alternatives',
        purpose:
            'Shows the visitor what a different city would get them — the same tour, a drive away, usually cheaper. Reach for this when the dates near the visitor are expensive, thin, or sold out, and somewhere they could plausibly travel to is materially better. Named in the source plan as the location lever; this catalog had nothing for it, which is why prompt v3 could ask you to reason about distance but gave you nowhere to act on it.',
        lever: 'location',
        sizes: ['standard', 'compact'],
        defaultSize: 'standard',
        propsSchema: z
            .object({
                /**
                 * Whose location the comparison is drawn from. Defaults to the
                 * visitor's metro; set it explicitly when comparing against
                 * somewhere else.
                 */
                anchor_metro: z.string().nullable().default(null),
                /**
                 * How far to look. Deliberately coarse words rather than a
                 * mileage number — the snapshot carries no distances, and you
                 * know from the city names which is which.
                 */
                reach: z.enum(['drivable', 'regional', 'anywhere']).default('drivable'),
                /** What the comparison leads with. */
                emphasis: z.enum(['savings', 'inventory', 'seat_quality']).default('savings'),
                max_alternatives: z.number().int().min(1).max(6).default(3),
            })
            .strict(),
        propsHint: [
            'anchor_metro: string | null  (default null = the visitor\'s own metro)',
            'reach: "drivable" | "regional" | "anywhere"  (default "drivable")',
            'emphasis: "savings" | "inventory" | "seat_quality"  (default "savings")',
            'max_alternatives: integer 1-6  (default 3)',
        ].join('\n'),
        dataRequirements: ['productions[].city', 'productions[].floor_price'],
        orchestrated: true,
        implemented: false,
    },

    sellout_urgency: {
        id: 'sellout_urgency',
        purpose:
            'Tells the visitor how fast inventory is moving, so they can judge whether waiting is a risk. Reach for this when the snapshot shows real scarcity — a selling-out event is material information, so cite the actual listing count, sellout risk, or sales velocity rather than an invented figure.',
        lever: 'price',
        sizes: ['hero', 'compact'],
        defaultSize: 'compact',
        propsSchema: z
            .object({
                risk: z.enum(['low', 'moderate', 'high']),
                message_tone: z.literal('factual').default('factual'),
            })
            .strict(),
        propsHint: [
            'risk: "low" | "moderate" | "high"  (required)',
            'message_tone: "factual"  (the only value)',
        ].join('\n'),
        dataRequirements: [
            'productions[].sellout_risk',
            'productions[].listing_count',
            'productions[].sales_velocity',
        ],
        orchestrated: true,
        implemented: false,
    },

    price_trend: {
        id: 'price_trend',
        purpose:
            'Answers "are prices dropping, and is this fairly priced" with a trend line and a plain-language read. Reach for this when the visitor has time before the event and price is their main lever.',
        lever: 'price',
        sizes: ['hero', 'standard', 'compact'],
        defaultSize: 'standard',
        propsSchema: z.object({ window_days: z.number().int().min(1).max(90).default(7) }).strict(),
        propsHint: 'window_days: integer 1-90  (default 7)',
        dataRequirements: ['productions[].price_trend_7d'],
        orchestrated: true,
        implemented: false,
    },

    budget_entry: {
        id: 'budget_entry',
        purpose:
            'Asks the visitor what they want to spend, then filters everything below it. Reach for this when the entry signals price sensitivity but you do not yet know the number.',
        lever: 'price',
        sizes: ['standard'],
        defaultSize: 'standard',
        propsSchema: z.object({ prefill: z.number().positive().nullable().default(null) }).strict(),
        propsHint: 'prefill: number | null  (default null; a budget to pre-fill the input with)',
        dataRequirements: [],
        orchestrated: true,
        implemented: false,
    },

    date_compare: {
        id: 'date_compare',
        purpose:
            'Ranks a strip of dates by value for the stated budget, so the visitor can see which night is the cost-effective one. Reach for this when the visitor is flexible on date.',
        lever: 'date',
        sizes: ['hero', 'standard', 'compact'],
        defaultSize: 'standard',
        propsSchema: z
            .object({ highlight: z.enum(['best_value', 'cheapest']).default('best_value') })
            .strict(),
        propsHint: 'highlight: "best_value" | "cheapest"  (default "best_value")',
        dataRequirements: ['productions', 'productions[].value_score'],
        orchestrated: true,
        implemented: false,
    },

    view_from_seat_value: {
        id: 'view_from_seat_value',
        purpose:
            'Surfaces the best view-per-dollar seats with enough section context to judge them. Reach for this when seat quality, not price alone, is what the visitor is weighing.',
        lever: 'seat_quality',
        sizes: ['standard'],
        defaultSize: 'standard',
        propsSchema: z.object({ max_picks: z.number().int().min(1).max(5).default(3) }).strict(),
        propsHint: 'max_picks: integer 1-5  (default 3)',
        dataRequirements: ['listings_sample[].view_score', 'listings_sample[].deal_score'],
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
