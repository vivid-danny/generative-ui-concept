import type { Context } from '@/contracts/context'
import type { LayoutSpec } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import { selectProductions, type ProductionListProps } from '@/modules/production-list/select'

/**
 * Turns a resolved spec into "what it actually composed" — the summary the
 * `/diff` page was showing, so the demo panel can show it too.
 *
 * Deliberately shared rather than duplicated: the spec says what was asked for,
 * this says what the page ended up rendering, and those two drifting apart in
 * two separate implementations is exactly the sort of thing that makes a demo
 * claim quietly untrue.
 */

export interface RenderedRow {
    id: string
    /** e.g. "Sat Dec 5" */
    date: string
    city: string
    floorPrice: number
    isHighlighted: boolean
}

export interface RenderedGroup {
    label: string
    rows: RenderedRow[]
}

export interface CompositionSummary {
    modules: { module: string; size: string }[]
    groups: RenderedGroup[]
    /** Rows on the page. */
    shown: number
    /** Every date in the snapshot, shown or not. */
    total: number
    /**
     * Dates the *filter* removed. Deliberately not "everything not shown" —
     * `max_items` can also truncate, so `shown + filteredOut` does not
     * necessarily equal `total`. The panel reports "N of M shown", which stays
     * true whatever the cause.
     */
    filteredOut: number
}

/**
 * No `timeZone` on purpose. Production dates are venue-local wall-clock strings
 * ("2026-12-05T19:30:00", no offset), so `new Date` parses them as local and
 * formatting them as local round-trips the calendar day. Pinning the formatter
 * to UTC shifted every date forward by one and disagreed with the card on the
 * page — which is exactly the kind of quiet inconsistency this panel exists to
 * rule out.
 */
const ROW_DATE = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
})

export function summarizeComposition(
    spec: LayoutSpec,
    market: Market,
    context: Context,
): CompositionSummary {
    const modules = spec.layout.map((entry) => ({
        module: entry.module,
        size: entry.size ?? 'standard',
    }))

    const listEntry = spec.layout.find((entry) => entry.module === 'production_list')
    if (!listEntry) {
        return { modules, groups: [], shown: 0, total: market.productions.length, filteredOut: 0 }
    }

    const selection = selectProductions(
        market,
        context,
        listEntry.props as unknown as ProductionListProps,
    )

    const groups: RenderedGroup[] = selection.groups.map((group) => ({
        label: group.label,
        rows: group.productions.map((production) => ({
            id: production.id,
            date: ROW_DATE.format(new Date(production.date)),
            city: production.city,
            floorPrice: production.floor_price,
            isHighlighted: production.id === selection.highlightedId,
        })),
    }))

    return {
        modules,
        groups,
        shown: groups.reduce((count, group) => count + group.rows.length, 0),
        total: market.productions.length,
        filteredOut: selection.filteredOutCount,
    }
}
