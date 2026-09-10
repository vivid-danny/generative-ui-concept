import type { Context } from '@/contracts/context'
import type { Market, Production, ProductionTrait, SelloutRisk } from '@/contracts/market'

import { daysOut, isWeekend } from '@/orchestration/derive'

import type { BadgeId } from './badges'
import type { CardSignal } from './trend'

/**
 * Turns a validated `production_list` props object into the exact rows to
 * render. Kept separate from the component because this is where the layout
 * spec actually changes the page — it is the part worth unit-testing, and the
 * part a viewer is really looking at when the composition shifts.
 */

export interface ProductionListProps {
    filter?: {
        max_price?: number
        min_view_score?: number
        city?: string
        min_demand_score?: number
        min_value_score?: number
        min_sales_velocity?: number
        sellout_risk?: SelloutRisk
        has_trait?: ProductionTrait
        day_type?: 'weekend' | 'weeknight'
        max_days_out?: number
        min_days_out?: number
    }
    sort: 'date' | 'price' | 'value' | 'demand'
    group_by_geo: boolean
    max_items: number
    /**
     * The section's own heading, set by the orchestrator when it places this
     * module more than once. Presentation only — it does not affect selection,
     * which is why nothing in this file reads it.
     */
    heading?: string | null
    /**
     * Badges this section may surface. Presentation only — selection does not
     * read it, which is why nothing else in this file does either.
     */
    badges?: readonly BadgeId[]
    /**
     * The signal beside each row's CTA. Presentation only, like `badges` and
     * `heading` — selection does not read it.
     */
    card_signal?: CardSignal | null
}

export interface ProductionGroup {
    key: string
    label: string
    productions: Production[]
}

export interface Selection {
    groups: ProductionGroup[]
    /**
     * True when an earlier section had already claimed dates. Lets an empty
     * section explain itself honestly rather than blaming the filter.
     */
    claimedByAnotherSection?: boolean
    /**
     * The page's recommended date, if this section is showing it.
     *
     * Null whenever the named date is not among the rows this section rendered —
     * filtered out, past `max_items`, or claimed by an earlier section. A named
     * recommendation that cannot be shown produces no label rather than a label
     * on some other row: the old `highlight` strategy *moved*, which is right
     * for a rule and wrong for a recommendation.
     */
    topPickId: string | null
    /** How many dates the filter removed. Shown so the page never lies by omission. */
    filteredOutCount: number
}

const BY_SORT: Record<ProductionListProps['sort'], (a: Production, b: Production) => number> = {
    date: (a, b) => a.date.localeCompare(b.date),
    price: (a, b) => a.floor_price - b.floor_price,
    // Both read the score, best first. They used to sort on `median_price`,
    // which predated `value_score` and `demand_score` — so "sort by value"
    // quietly meant "sort by typical price", which is not what the orchestrator
    // would assume when it asks for it.
    value: (a, b) => b.value_score - a.value_score,
    demand: (a, b) => b.demand_score - a.demand_score,
}

export function selectProductions(
    market: Market,
    context: Context,
    props: ProductionListProps,
    /**
     * Dates an earlier section already showed.
     *
     * A date must not appear twice on one page — a "weekend road trip" section
     * repeating the visitor's home-city night makes the page look like it is
     * padding. This is enforced here rather than asked of the orchestrator,
     * because a rule the model can reason its way around is not a hard rule.
     * The renderer accumulates the set in section order, so the first section to
     * claim a date keeps it, which matches the deliberate hero-first ordering.
     */
    exclude?: ReadonlySet<string>,
    /** The page's recommended date, from the spec rather than from props. */
    topPick?: string | null,
): Selection {
    const { filter, sort, group_by_geo: groupByGeo, max_items: maxItems } = props

    const matching = market.productions.filter((production) => {
        if (exclude?.has(production.id)) return false
        if (filter?.max_price !== undefined && production.floor_price > filter.max_price) return false
        if (filter?.city !== undefined && production.city !== filter.city) return false
        if (filter?.min_demand_score !== undefined && production.demand_score < filter.min_demand_score)
            return false
        if (filter?.min_value_score !== undefined && production.value_score < filter.min_value_score)
            return false
        if (
            filter?.min_sales_velocity !== undefined &&
            production.sales_velocity < filter.min_sales_velocity
        )
            return false
        if (filter?.sellout_risk !== undefined && production.sellout_risk !== filter.sellout_risk)
            return false
        if (filter?.has_trait !== undefined && !production.traits.includes(filter.has_trait))
            return false
        // Derived from the date rather than stored: the calendar is not a
        // property of the inventory, and a fixture that hardcoded weekdays
        // would go wrong the moment the dates moved.
        if (filter?.day_type !== undefined) {
            const weekend = isWeekend(production.date)
            if (filter.day_type === 'weekend' && !weekend) return false
            if (filter.day_type === 'weeknight' && weekend) return false
        }
        if (filter?.max_days_out !== undefined || filter?.min_days_out !== undefined) {
            const out = daysOut(production.date, market.captured_at)
            if (filter.max_days_out !== undefined && out > filter.max_days_out) return false
            if (filter.min_days_out !== undefined && out < filter.min_days_out) return false
        }
        return true
    })

    const sorted = [...matching].sort(BY_SORT[sort])
    const visible = sorted.slice(0, maxItems)

    // A membership test, not a search: the pick is honoured only if this section
    // is actually rendering that row.
    const topPickId = visible.some((production) => production.id === topPick)
        ? (topPick as string)
        : null

    const groups: ProductionGroup[] = []
    if (groupByGeo) {
        const near = visible.filter((production) => production.city === context.geo.metro)
        const away = visible.filter((production) => production.city !== context.geo.metro)
        if (near.length > 0) {
            groups.push({ key: 'near', label: `Near ${context.geo.metro}`, productions: near })
        }
        if (away.length > 0) {
            groups.push({
                key: 'away',
                label: near.length > 0 ? 'Worth the drive' : 'All dates',
                productions: away,
            })
        }
    } else if (visible.length > 0) {
        groups.push({ key: 'all', label: 'All dates', productions: visible })
    }

    return {
        groups,
        topPickId,
        // Counted against what this section could have shown, so a date claimed
        // by an earlier section is not reported as something the filter removed.
        filteredOutCount: market.productions.length - (exclude?.size ?? 0) - matching.length,
        claimedByAnotherSection: exclude !== undefined && exclude.size > 0,
    }
}

/**
 * The exclusion set for each entry in a layout, in render order.
 *
 * Lives here rather than in the renderer because working out which dates a
 * section will claim means running that section's selection, and that is this
 * module's business. The renderer and the demo panel both consume it, so
 * computing it once in one place is what keeps the page and the panel telling
 * the same story.
 *
 * Returns an array aligned to `layout` — `undefined` for entries that are not
 * production lists, so callers can index straight into it.
 */
export function resolveExclusions(
    layout: readonly { module: string; props: Record<string, unknown> }[],
    market: Market,
    context: Context,
): (ReadonlySet<string> | undefined)[] {
    const claimed = new Set<string>()

    return layout.map((entry) => {
        if (entry.module !== 'production_list') return undefined

        // What this section sees, given everything claimed before it.
        const exclude = new Set(claimed)
        const selection = selectProductions(
            market,
            context,
            entry.props as unknown as ProductionListProps,
            exclude,
        )
        for (const group of selection.groups) {
            for (const production of group.productions) claimed.add(production.id)
        }

        return exclude
    })
}
