import type { Context } from '@/contracts/context'
import type { Market, Production } from '@/contracts/market'

import type { BadgeId } from './badges'

/**
 * Turns a validated `production_list` props object into the exact rows to
 * render. Kept separate from the component because this is where the layout
 * spec actually changes the page — it is the part worth unit-testing, and the
 * part a viewer is really looking at when the composition shifts.
 */

export interface ProductionListProps {
    filter?: { max_price?: number; min_view_score?: number; city?: string }
    sort: 'date' | 'price' | 'value'
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
    // "Value" is what a typical seat costs, not the cheapest one available.
    value: (a, b) => a.median_price - b.median_price,
}

const BY_HIGHLIGHT: Record<
    NonNullable<ProductionListProps['highlight']>,
    (a: Production, b: Production) => number
> = {
    cheapest: (a, b) => a.floor_price - b.floor_price,
    best_value: (a, b) => a.median_price - b.median_price,
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
