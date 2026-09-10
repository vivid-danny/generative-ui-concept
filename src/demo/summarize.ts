import type { Context } from '@/contracts/context'
import type { LayoutSpec } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import {
    resolveExclusions,
    selectProductions,
    type ProductionListProps,
} from '@/modules/production-list/select'

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
    /**
     * Sections the orchestrator asked for that have no members, and why. Not
     * shown to the visitor — an empty section renders nothing — so this is the
     * only place the composition's misses are visible.
     */
    emptySections: { heading: string; reason: 'no matches' | 'already shown above' }[]
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

    // Every instance, not just the first. Once the orchestrator can place
    // `production_list` as several sections, summarising only one would show a
    // third of the page and report the wrong counts — and this panel is what
    // gets read to understand what the composition actually did.
    const listEntries = spec.layout.filter((entry) => entry.module === 'production_list')
    if (listEntries.length === 0) {
        return {
            modules,
            emptySections: [],
            groups: [],
            shown: 0,
            total: market.productions.length,
            filteredOut: 0,
        }
    }

    // The same exclusions the renderer applies, so the panel describes the page
    // that is actually on screen rather than one section's view of it.
    const exclusions = resolveExclusions(spec.layout, market, context)
    const exclusionFor = new Map(
        spec.layout.map((entry, index) => [entry, exclusions[index]] as const),
    )

    const groups: RenderedGroup[] = []
    const shownIds = new Set<string>()
    const emptySections: CompositionSummary['emptySections'] = []

    for (const entry of listEntries) {
        const props = entry.props as unknown as ProductionListProps
        const selection = selectProductions(market, context, props, exclusionFor.get(entry))

        if (selection.groups.length === 0) {
            emptySections.push({
                heading: props.heading ?? '(unnamed section)',
                reason: selection.claimedByAnotherSection ? 'already shown above' : 'no matches',
            })
            continue
        }

        for (const group of selection.groups) {
            groups.push({
                // A section's own heading names it; the generated label is the
                // fallback for a single unheaded list.
                label: props.heading ?? group.label,
                rows: group.productions.map((production) => {
                    shownIds.add(production.id)
                    return {
                        id: production.id,
                        date: ROW_DATE.format(new Date(production.date)),
                        city: production.city,
                        floorPrice: production.floor_price,
                        isHighlighted: production.id === selection.highlightedId,
                    }
                }),
            })
        }
    }

    // Counted by distinct date, so a date appearing in two sections is not
    // double-counted against the tour total.
    const shown = shownIds.size

    // `filteredOut` means "removed by a filter", which is what the panel claims
    // — not "not shown", which would also count `max_items` truncation and make
    // that label false. Across sections a date counts as filtered out only if no
    // section's filter would admit it, so re-running each selection with the cap
    // lifted gives the set that survived filtering. Reuses `selectProductions`
    // rather than duplicating the filter predicate, which would then be free to
    // drift from the one that actually renders.
    const admitted = new Set<string>()
    for (const entry of listEntries) {
        const props = entry.props as unknown as ProductionListProps
        const uncapped = selectProductions(
            market,
            context,
            { ...props, max_items: market.productions.length },
            exclusionFor.get(entry),
        )
        for (const group of uncapped.groups) {
            for (const production of group.productions) admitted.add(production.id)
        }
    }
    const filteredOut = market.productions.length - admitted.size

    return {
        modules,
        emptySections,
        groups,
        shown,
        total: market.productions.length,
        filteredOut,
    }
}
