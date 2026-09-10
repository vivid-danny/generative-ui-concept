import type { Market, Production } from '@/contracts/market'

/**
 * The stats the `market_signals` card can show, and how each one is read off
 * the snapshot.
 *
 * The same split that governs badges, one level up: **the orchestrator picks
 * which stats appear and in what order; we own the copy and the number.** Each
 * stat makes a claim about the tour — what it costs, which way prices moved,
 * how much demand there is — so the wording is ours and vetted, and the value
 * comes from the snapshot rather than from the model. The card's heading is
 * fixed at `CARD_HEADING` and not a prop at all — the orchestrator already
 * writes every section heading in the main column, and one more piece of
 * generated copy in the rail was noise rather than relevance. What varies here
 * is which facts appear, which is the decision worth having.
 *
 * Two things deliberately absent, both from the Figma frame (17433:28650):
 *
 * - **"1,024 tickets sold in the last 24 hours."** There is no sales-volume
 *   field, and a tour-level `tickets_sold_24h` would be a single constant
 *   dressed as data — identical for every visitor, so it demonstrates nothing.
 *   `selling_out` carries the same urgency off a real field.
 * - **"343 Fans shopping tickets now."** That figure was hardcoded in
 *   `PerformerRail`; `fans_viewing` replaces it with the summed
 *   `fans_viewed_24h`, which is why the number is so much larger.
 *
 * Fact copy is kept short on purpose: the rail is 308px of text, and a
 * six-figure count plus a long sentence wraps to two lines. The card handles
 * wrapping rather than truncating — a fact cut off mid-number is worse than a
 * fact on two lines — but staying inside one line is better than either.
 *
 * Every stat is tour-level, never scoped to a section's filter or the visitor's
 * budget. The card sits beside the whole page rather than inside a section, so
 * a budget-scoped number would contradict the tour-level heading above it.
 */

export const STAT_IDS = [
    'fan_demand',
    'lowest_price',
    'typical_price',
    'price_direction',
    'selling_out',
    'fans_viewing',
    'tour_scale',
    'tickets_available',
] as const

export type StatId = (typeof STAT_IDS)[number]

/**
 * Which of the card's two shapes a stat takes.
 *
 * Not a prop. Where a stat sits is form, and carrying it in the definition is
 * what lets the orchestrator pass one ordered array instead of two — a
 * sentence can never land in a label/value slot by accident.
 */
export type StatForm = 'metric' | 'fact'

/** Icon keys. Resolved to components by the card, so this file stays pure. */
export type StatIcon = 'flame' | 'eye' | 'microphone' | 'ticket'

interface MetricStat {
    id: StatId
    form: 'metric'
    /** Pre-written, sits above the value. */
    label: string
    applies: (market: Market) => boolean
    value: (market: Market) => string
}

interface FactStat {
    id: StatId
    form: 'fact'
    icon: StatIcon
    applies: (market: Market) => boolean
    /** The whole sentence. Pre-written apart from the number. */
    text: (market: Market) => string
}

export type StatDefinition = MetricStat | FactStat

const count = (market: Market) => market.productions.length
const sum = (market: Market, field: (production: Production) => number) =>
    market.productions.reduce((total, production) => total + field(production), 0)
const mean = (market: Market, field: (production: Production) => number) =>
    sum(market, field) / count(market)

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = sorted.length / 2

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[Math.floor(middle)]
}

/** Pick the first band whose threshold the value clears. Bands run high to low. */
function band(value: number, bands: readonly [number, string][]): string {
    return bands.find(([floor]) => value >= floor)?.[1] ?? bands[bands.length - 1][1]
}

/**
 * Demand as a level, not a direction.
 *
 * The Figma reads "Slowly Increasing", which the snapshot cannot support —
 * `demand_score` is a standing measure with no history behind it, so any
 * direction would be invented. A level is what the data actually says.
 */
const DEMAND_BANDS: readonly [number, string][] = [
    [0.8, 'Very high'],
    [0.65, 'High'],
    [0.45, 'Steady'],
    [-Infinity, 'Quiet'],
]

/** The one honest direction in the snapshot: `price_trend_7d` is a change. */
const PRICE_BANDS: readonly [number, string][] = [
    [0.03, 'Rising'],
    [0.005, 'Edging up'],
    [-0.005, 'Holding steady'],
    [-0.03, 'Easing'],
    [-Infinity, 'Falling'],
]

const dollars = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`
const whole = (amount: number) => amount.toLocaleString('en-US')

const highRiskCount = (market: Market) =>
    market.productions.filter((production) => production.sellout_risk === 'high').length

export const STATS: Record<StatId, StatDefinition> = {
    fan_demand: {
        id: 'fan_demand',
        form: 'metric',
        label: 'Fan demand',
        applies: () => true,
        value: (market) => band(mean(market, (p) => p.demand_score), DEMAND_BANDS),
    },
    lowest_price: {
        id: 'lowest_price',
        form: 'metric',
        label: 'Lowest ticket price',
        applies: () => true,
        // Integer dollars, matching the card's "From $54". The Figma's $81.74
        // implies cents the snapshot's integer floors do not have.
        value: (market) => dollars(Math.min(...market.productions.map((p) => p.floor_price))),
    },
    typical_price: {
        id: 'typical_price',
        form: 'metric',
        label: 'Typical ticket price',
        applies: () => true,
        // Median of the *floor* prices — what a date costs to get into. Not
        // `median_price`, which is the median listing on a date and answers a
        // different question than the one this label asks.
        value: (market) => dollars(median(market.productions.map((p) => p.floor_price))),
    },
    price_direction: {
        id: 'price_direction',
        form: 'metric',
        label: 'Prices this week',
        applies: () => true,
        value: (market) => band(mean(market, (p) => p.price_trend_7d), PRICE_BANDS),
    },
    selling_out: {
        id: 'selling_out',
        form: 'fact',
        icon: 'flame',
        applies: (market) => highRiskCount(market) > 0,
        text: (market) => `${whole(highRiskCount(market))} dates are selling out fast`,
    },
    fans_viewing: {
        id: 'fans_viewing',
        form: 'fact',
        icon: 'eye',
        applies: (market) => sum(market, (p) => p.fans_viewed_24h) > 0,
        text: (market) =>
            `${whole(sum(market, (p) => p.fans_viewed_24h))} fans viewed in the last 24 hours`,
    },
    tour_scale: {
        id: 'tour_scale',
        form: 'fact',
        icon: 'microphone',
        applies: () => true,
        text: (market) => {
            const cities = new Set(market.productions.map((p) => p.city)).size
            return `${whole(count(market))} tour dates in ${whole(cities)} cities`
        },
    },
    tickets_available: {
        id: 'tickets_available',
        form: 'fact',
        icon: 'ticket',
        applies: (market) => sum(market, (p) => p.listing_count) > 0,
        text: (market) =>
            `${whole(sum(market, (p) => p.listing_count))} tickets available on the tour`,
    },
}


/**
 * How many of each shape the card holds.
 *
 * The component's call, not the orchestrator's: two side by side is what fits
 * a 340px rail, and a fourth row turns a glanceable card into a list. The
 * orchestrator's order decides which survive the cap.
 */
export const MAX_METRICS = 2
export const MAX_FACTS = 3

export interface ResolvedMetric {
    id: StatId
    label: string
    value: string
}

export interface ResolvedFact {
    id: StatId
    icon: StatIcon
    text: string
}

export interface ResolvedSignals {
    metrics: ResolvedMetric[]
    facts: ResolvedFact[]
}

export interface MarketSignalsProps {
    stats: StatId[]
}

/**
 * The card's title. Ours, fixed, and deliberately not a prop.
 *
 * It has to stay true of every possible stat mix, which rules out anything
 * about price specifically — and once it must be that general, there is nothing
 * for the model to add by writing it.
 */
export const CARD_HEADING = 'Event Trends'

/**
 * What the card actually shows, given what the orchestrator asked for.
 *
 * Requests are honoured in order and then narrowed three ways: duplicates
 * collapse, a stat with nothing behind it in this snapshot is dropped, and each
 * shape is capped. So naming a stat is a request rather than a guarantee —
 * the same contract as a badge allowlist.
 */
export function resolveSignals(market: Market, props: MarketSignalsProps): ResolvedSignals {
    const requested = [...new Set(props.stats)]
        .map((id) => STATS[id])
        .filter((stat): stat is StatDefinition => Boolean(stat) && stat.applies(market))

    const metrics = requested
        .filter((stat): stat is MetricStat => stat.form === 'metric')
        .slice(0, MAX_METRICS)
        .map((stat) => ({ id: stat.id, label: stat.label, value: stat.value(market) }))

    const facts = requested
        .filter((stat): stat is FactStat => stat.form === 'fact')
        .slice(0, MAX_FACTS)
        .map((stat) => ({ id: stat.id, icon: stat.icon, text: stat.text(market) }))

    return { metrics, facts }
}
