import type { Production } from '@/contracts/market'

/**
 * The production-listing badges, from the VS design system
 * (fileKey QITaTxYPUrqmzzB6NVayVu, node 10571:85566).
 *
 * Two decisions are split here, and keeping them apart is the whole point:
 *
 * - **The orchestrator picks which badges are eligible for a section.** That is
 *   an editorial choice about what this visitor cares about — a price-sensitive
 *   browse wants value signals, a crowd-seeker wants popularity.
 * - **The data decides which rows actually get one.** A section that surfaces
 *   "Selling Fast" shows it only on the dates that are, so rows share a
 *   vocabulary without being identical. Applying a badge to every card in a
 *   section would be both redundant and, on most of them, untrue.
 *
 * Copy is pre-written and comes from the design system, never composed. A badge
 * asserts something about inventory or demand, so the wording is ours and
 * vetted — see docs/COMPOSABILITY.md on selective versus generative knobs.
 *
 * Not modelled: Giveaway and Presale Now (no data behind them), and the sports
 * attributes (Top Matchup, Division Rivalry, MNF/TNF) which do not apply to a
 * concert tour.
 */

export const BADGE_IDS = [
    'deals_available',
    'selling_fast',
    'tickets_left',
    'fans_viewed',
    'newly_released',
] as const

export type BadgeId = (typeof BADGE_IDS)[number]

/** Which visual treatment the card gives a badge. */
export type BadgeTone = 'value' | 'scarcity' | 'popularity' | 'time'

export interface BadgeDefinition {
    id: BadgeId
    tone: BadgeTone
    /** Emoji prefix, as the design system shows them. */
    icon: string
    /** True when this date qualifies. The per-row half of the decision. */
    applies: (production: Production) => boolean
    /** Pre-written copy. Takes the production only to fill in a real number. */
    label: (production: Production) => string
}

/** Prices have moved enough to be worth telling someone about. */
const DEAL_TREND = -0.03
/** Top of the velocity range — "fast" has to mean fast, or it means nothing. */
const FAST_VELOCITY = 0.7
/** Below this a viewer count is not interesting enough to spend a badge on. */
const NOTABLE_VIEWERS = 1500
/** Recently added to the tour, rather than part of the original announcement. */
const RECENTLY_ANNOUNCED_DAYS = 7

export const BADGES: Record<BadgeId, BadgeDefinition> = {
    deals_available: {
        id: 'deals_available',
        tone: 'value',
        icon: '💰',
        applies: (production) => production.price_trend_7d <= DEAL_TREND,
        label: () => 'Deals Available',
    },
    selling_fast: {
        id: 'selling_fast',
        tone: 'value',
        icon: '🔥',
        applies: (production) => production.sales_velocity >= FAST_VELOCITY,
        label: () => 'Selling Fast',
    },
    tickets_left: {
        id: 'tickets_left',
        tone: 'scarcity',
        icon: '🔥',
        applies: (production) => production.sellout_risk === 'high',
        label: (production) => `${production.listing_count.toLocaleString('en-US')} Tickets Left`,
    },
    fans_viewed: {
        id: 'fans_viewed',
        tone: 'popularity',
        icon: '👀',
        applies: (production) => production.fans_viewed_24h >= NOTABLE_VIEWERS,
        label: (production) =>
            `${production.fans_viewed_24h.toLocaleString('en-US')} Fans Viewed`,
    },
    newly_released: {
        id: 'newly_released',
        tone: 'time',
        icon: '•',
        applies: (production) => production.announced_days_ago <= RECENTLY_ANNOUNCED_DAYS,
        label: () => 'Newly Released',
    },
}

/**
 * How many badges one row may show, and in what order.
 *
 * Both are the component's call, not the orchestrator's: how much fits on a row
 * and what reads first is form, and a card carrying five badges stops being
 * scannable no matter how relevant each one is. Scarcity leads because a date
 * running out is the most consequential thing a row can say.
 */
export const MAX_BADGES_PER_ROW = 3

const RENDER_ORDER: BadgeId[] = [
    'tickets_left',
    'selling_fast',
    'deals_available',
    'newly_released',
    'fans_viewed',
]

/** The badges this row shows, given what the section made eligible. */
export function badgesFor(production: Production, eligible: readonly BadgeId[]): BadgeDefinition[] {
    const allowed = new Set(eligible)

    return RENDER_ORDER.filter((id) => allowed.has(id) && BADGES[id].applies(production))
        .slice(0, MAX_BADGES_PER_ROW)
        .map((id) => BADGES[id])
}
