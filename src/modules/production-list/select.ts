import type { Context } from '@/contracts/context'
import type { Market, Production, ProductionTrait, SelloutRisk } from '@/contracts/market'

import type { BadgeId } from './badges'

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
    }
    sort: 'date' | 'price' | 'value' | 'demand'
    highlight: 'best_value' | 'cheapest' | 'soonest' | null
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
}

export interface ProductionGroup {
    key: string
    label: string
    productions: Production[]
}

export interface Selection {
    groups: ProductionGroup[]
    /** Production id the composition wants noticed, if any. */
    highlightedId: string | null
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

const BY_HIGHLIGHT: Record<
    NonNullable<ProductionListProps['highlight']>,
    (a: Production, b: Production) => number
> = {
    cheapest: (a, b) => a.floor_price - b.floor_price,
    best_value: (a, b) => b.value_score - a.value_score,
    soonest: (a, b) => a.date.localeCompare(b.date),
}

export function selectProductions(
    market: Market,
    context: Context,
    props: ProductionListProps,
): Selection {
    const { filter, sort, highlight, group_by_geo: groupByGeo, max_items: maxItems } = props

    const matching = market.productions.filter((production) => {
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
        return true
    })

    const sorted = [...matching].sort(BY_SORT[sort])
    const visible = sorted.slice(0, maxItems)

    const highlightedId =
        highlight === null || visible.length === 0
            ? null
            : [...visible].sort(BY_HIGHLIGHT[highlight])[0].id

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
        highlightedId,
        filteredOutCount: market.productions.length - matching.length,
    }
}
