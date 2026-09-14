import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import { MODULE_CATALOG } from '@/contracts/module-catalog'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'

import { resolveExclusions, selectProductions, type ProductionListProps } from './select'

/**
 * This is where the layout spec actually changes the page, so it is worth
 * testing directly: if these props stop mapping to visible differences, the
 * prototype's whole claim stops being demonstrable even though every other test
 * still passes.
 */

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(leahBudget80)

/** Props as the validator would hand them over — schema defaults applied. */
function props(overrides: Partial<ProductionListProps> = {}): ProductionListProps {
    return {
        ...(MODULE_CATALOG.production_list.propsSchema.parse({}) as ProductionListProps),
        ...overrides,
    }
}

const allDates = (selection: ReturnType<typeof selectProductions>) =>
    selection.groups.flatMap((group) => group.productions)

describe('selectProductions', () => {
    it('filters nothing out when there is no filter, capping at max_items', () => {
        // The tour is longer than the 20-item cap, so "show everything" is bounded
        // by max_items — but that is truncation, not filtering. filteredOutCount
        // counts only what a filter removed, so with no filter it stays zero.
        const selection = selectProductions(market, context, props({ max_items: 20 }))

        expect(allDates(selection)).toHaveLength(Math.min(20, market.productions.length))
        expect(selection.filteredOutCount).toBe(0)
    })

    it('filters by price ceiling and reports what it hid', () => {
        const selection = selectProductions(market, context, props({ filter: { max_price: 80 }, max_items: 20 }))
        const shown = allDates(selection)

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every((production) => production.floor_price <= 80)).toBe(true)
        expect(selection.filteredOutCount).toBe(market.productions.length - shown.length)
    })

    // Sorting is applied before grouping, so these assert on an ungrouped list —
    // with geo grouping on, the visitor's own metro is intentionally lifted to
    // the top regardless of sort.
    it('sorts by price when asked, not just by date', () => {
        const byPrice = allDates(
            selectProductions(market, context, props({ sort: 'price', group_by_geo: false, max_items: 20 })),
        )
        const prices = byPrice.map((production) => production.floor_price)

        expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    })

    it('sorts by date by default', () => {
        const byDate = allDates(
            selectProductions(market, context, props({ group_by_geo: false, max_items: 20 })),
        )
        const dates = byDate.map((production) => production.date)

        expect([...dates].sort()).toEqual(dates)
    })

    it('groups by the composition’s metro, not the context’s, when the spec names one', () => {
        // The context fixture says Chicago; the brief said Los Angeles. Before
        // `visitor_metro` existed the model could only avoid this by switching
        // `group_by_geo` off — a composition bent around a rendering limit.
        //
        // `max_items` is the whole tour on purpose: truncation happens before
        // grouping, and LA's three dates are the 47th, 48th and 50th cheapest
        // of 52, so a smaller cap removes them before there is anything to
        // group and the test passes for the wrong reason.
        const grouped = selectProductions(
            market,
            context,
            props({ sort: 'price', group_by_geo: true, max_items: 52 }),
            undefined,
            null,
            'Los Angeles',
        )

        expect(grouped.groups[0].key).toBe('near')
        expect(grouped.groups[0].label).toBe('Near Los Angeles')
        expect(grouped.groups[0].productions.every((p) => p.city === 'Los Angeles')).toBe(true)
    })

    it('falls back to the context’s metro when the spec names none', () => {
        const grouped = selectProductions(
            market,
            context,
            props({ sort: 'price', group_by_geo: true, max_items: 52 }),
            undefined,
            null,
            null,
        )

        expect(grouped.groups[0].label).toBe(`Near ${context.geo.metro}`)
    })

    it('lifts the visitor’s own metro above the sort order when grouping by geo', () => {
        const grouped = allDates(
            selectProductions(market, context, props({ sort: 'price', group_by_geo: true, max_items: 20 })),
        )

        // Chicago's floor prices are not the lowest, so if grouping were not
        // taking precedence these would not come first.
        expect(grouped[0].city).toBe('Chicago')
    })

    it('caps the list at max_items', () => {
        const selection = selectProductions(market, context, props({ max_items: 3 }))

        expect(allDates(selection)).toHaveLength(3)
    })


    it('separates the visitor’s metro from everywhere else', () => {
        const selection = selectProductions(market, context, props({ group_by_geo: true, max_items: 20 }))

        expect(selection.groups.map((group) => group.key)).toEqual(['near', 'away'])
        const near = selection.groups.find((group) => group.key === 'near')!
        expect(near.label).toBe('Near Chicago')
        expect(near.productions.every((production) => production.city === 'Chicago')).toBe(true)
    })

    it('collapses to a single group when geo grouping is off', () => {
        const selection = selectProductions(market, context, props({ group_by_geo: false, max_items: 20 }))

        expect(selection.groups).toHaveLength(1)
        expect(selection.groups[0].key).toBe('all')
    })

    it('returns no groups when the filter excludes everything', () => {
        const selection = selectProductions(market, context, props({ filter: { max_price: 1 } }))

        expect(selection.groups).toHaveLength(0)
        expect(selection.filteredOutCount).toBe(market.productions.length)
    })

})

describe('selectProductions — demand, value and trait collections', () => {
    const all = (selection: ReturnType<typeof selectProductions>) =>
        selection.groups.flatMap((group) => group.productions)

    const pick = (overrides: Partial<ProductionListProps>) =>
        all(selectProductions(market, context, props({ group_by_geo: false, max_items: 52, ...overrides })))

    it('scopes to high-demand dates', () => {
        const shown = pick({ filter: { min_demand_score: 0.9 } })

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every((p) => p.demand_score >= 0.9)).toBe(true)
        expect(shown.length).toBeLessThan(market.productions.length)
    })

    it('scopes to good-value dates', () => {
        const shown = pick({ filter: { min_value_score: 0.85 } })

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every((p) => p.value_score >= 0.85)).toBe(true)
    })

    it('scopes to dates likely to sell out', () => {
        // The section heading "Likely to sell out" was copy over an unfiltered
        // list until this existed.
        const shown = pick({ filter: { sellout_risk: 'high' } })

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every((p) => p.sellout_risk === 'high')).toBe(true)
    })

    it('scopes to dates moving fastest', () => {
        const shown = pick({ filter: { min_sales_velocity: 0.85 } })

        expect(shown.every((p) => p.sales_velocity >= 0.85)).toBe(true)
    })

    it('scopes to a trait, so a heading can name it', () => {
        const shown = pick({ filter: { has_trait: 'tour_finale' } })

        expect(shown).toHaveLength(1)
        expect(shown[0].traits).toContain('tour_finale')
    })

    it('combines a trait with other criteria', () => {
        const shown = pick({ filter: { has_trait: 'hometown_show', max_price: 220 } })

        expect(shown.every((p) => p.traits.includes('hometown_show') && p.floor_price <= 220)).toBe(
            true,
        )
    })

    it('returns nothing when a collection has no members, rather than falling back', () => {
        // Better an empty section the module reports than a heading over dates
        // that do not match it.
        const shown = pick({ filter: { min_demand_score: 1, sellout_risk: 'low' } })

        expect(shown).toHaveLength(0)
    })
})

describe('selectProductions — value and demand sorts', () => {
    const ordered = (overrides: Partial<ProductionListProps>) =>
        selectProductions(market, context, props({ group_by_geo: false, max_items: 52, ...overrides }))
            .groups.flatMap((group) => group.productions)

    it('sorts by value score, best first', () => {
        // These used to sort on median_price, which predated value_score — so
        // "sort by value" quietly meant "sort by typical price".
        const scores = ordered({ sort: 'value' }).map((p) => p.value_score)

        expect(scores).toEqual([...scores].sort((a, b) => b - a))
    })

    it('sorts by demand score, best first', () => {
        const scores = ordered({ sort: 'demand' }).map((p) => p.demand_score)

        expect(scores).toEqual([...scores].sort((a, b) => b - a))
    })

})

describe('selectProductions — weekend and lead time', () => {
    const pick = (overrides: Partial<ProductionListProps>) =>
        selectProductions(market, context, props({ group_by_geo: false, max_items: 52, ...overrides }))
            .groups.flatMap((group) => group.productions)

    // Fri=5, Sat=6, Sun=0 — read off the local date, matching derive.ts.
    const dayOf = (production: { date: string }) => new Date(production.date).getDay()
    const isWeekendDay = (production: { date: string }) => [5, 6, 0].includes(dayOf(production))

    it('scopes to weekend nights', () => {
        // The gap the eval exposed: the brief said she could travel "on a
        // weekend" and there was no way to build that collection.
        const shown = pick({ filter: { day_type: 'weekend' } })

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every(isWeekendDay)).toBe(true)
    })

    it('scopes to weeknights', () => {
        const shown = pick({ filter: { day_type: 'weeknight' } })

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.every((production) => !isWeekendDay(production))).toBe(true)
    })

    it('splits the tour between the two, losing nothing', () => {
        const weekend = pick({ filter: { day_type: 'weekend' } }).length
        const weeknight = pick({ filter: { day_type: 'weeknight' } }).length

        expect(weekend + weeknight).toBe(market.productions.length)
    })

    it('scopes to dates within a lead time', () => {
        const shown = pick({ filter: { max_days_out: 120 } })
        const captured = new Date(`${market.captured_at}T00:00:00`)

        expect(shown.length).toBeGreaterThan(0)
        expect(shown.length).toBeLessThan(market.productions.length)
        for (const production of shown) {
            const out = (new Date(production.date).getTime() - captured.getTime()) / 86_400_000
            expect(out).toBeLessThanOrEqual(121)
        }
    })

    it('scopes to dates beyond a lead time', () => {
        const soon = pick({ filter: { max_days_out: 120 } }).map((p) => p.id)
        const later = pick({ filter: { min_days_out: 121 } }).map((p) => p.id)

        expect(soon.some((id) => later.includes(id))).toBe(false)
        expect(soon.length + later.length).toBe(market.productions.length)
    })

    it('combines a weekend with distance and budget, which is what the brief asks for', () => {
        const shown = pick({
            filter: { day_type: 'weekend', city: 'Milwaukee', max_price: 80 },
        })

        expect(shown.every((p) => isWeekendDay(p) && p.city === 'Milwaukee' && p.floor_price <= 80))
            .toBe(true)
    })
})

describe('resolveExclusions', () => {
    /**
     * The hard rule — no date appears twice on a page — plus the invariant that
     * makes it work: the returned array is aligned to position in the *whole*
     * layout, including entries that are not lists. The renderer reads
     * `exclusions[index]` while mapping every entry, so anything that filters
     * the layout before mapping hands a section someone else's exclusions.
     */

    const listEntry = (heading: string, overrides: Partial<ProductionListProps> = {}) => ({
        module: 'production_list',
        props: {
            ...props(overrides),
            heading,
            group_by_geo: false,
        } as unknown as Record<string, unknown>,
    })

    it('claims dates in render order, so no date is offered twice', () => {
        const layout = [
            listEntry('Cheapest first', { sort: 'price' }),
            listEntry('Soonest', { sort: 'date' }),
        ]
        const [first, second] = resolveExclusions(layout, market, context)

        expect(first?.size ?? 0).toBe(0)
        expect(second?.size).toBeGreaterThan(0)

        const shownFirst = allDates(
            selectProductions(market, context, layout[0].props as unknown as ProductionListProps),
        ).map((production) => production.id)

        for (const id of shownFirst) expect(second?.has(id)).toBe(true)
    })

    it('stays aligned to layout position when a non-list module is in the way', () => {
        const layout = [
            listEntry('Near you'),
            { module: 'market_signals', props: {} as Record<string, unknown> },
            listEntry('Everywhere else'),
        ]
        const exclusions = resolveExclusions(layout, market, context)

        expect(exclusions).toHaveLength(3)
        // The rail card claims nothing, and — the part that matters — the second
        // list's exclusions land at index 2, not at index 1.
        expect(exclusions[1]).toBeUndefined()
        expect(exclusions[0]?.size ?? 0).toBe(0)
        expect(exclusions[2]?.size).toBeGreaterThan(0)
    })
})

describe('selectProductions — the page\'s top pick', () => {
    /**
     * The pick is a named date, not a strategy, so the only question a section
     * answers is "am I showing that row". Every case below where the answer is
     * no must produce *no* label rather than a label on a neighbour — the old
     * `highlight` enum moved the outline to whatever was nearest, which is right
     * for a rule and wrong for a recommendation.
     */

    const chicago = market.productions.find((production) => production.city === 'Chicago')!
    const indianapolis = market.productions.find(
        (production) => production.city === 'Indianapolis',
    )!

    it('labels the date the composition named', () => {
        const selection = selectProductions(
            market,
            context,
            props({ group_by_geo: false, max_items: 52 }),
            undefined,
            chicago.id,
        )

        expect(selection.topPickId).toBe(chicago.id)
    })

    it('labels nothing when the named date was filtered out', () => {
        const selection = selectProductions(
            market,
            context,
            props({ filter: { city: 'Chicago' }, group_by_geo: false, max_items: 52 }),
            undefined,
            indianapolis.id,
        )

        expect(selection.topPickId).toBeNull()
    })

    it('labels nothing when the named date is past max_items', () => {
        const byDate = [...market.productions].sort((a, b) => a.date.localeCompare(b.date))
        const beyondTheCap = byDate[10]

        const selection = selectProductions(
            market,
            context,
            props({ sort: 'date', group_by_geo: false, max_items: 3 }),
            undefined,
            beyondTheCap.id,
        )

        expect(allDates(selection).map((production) => production.id)).not.toContain(
            beyondTheCap.id,
        )
        expect(selection.topPickId).toBeNull()
    })

    it('labels nothing when an earlier section already claimed the named date', () => {
        const selection = selectProductions(
            market,
            context,
            props({ group_by_geo: false, max_items: 52 }),
            new Set([chicago.id]),
            chicago.id,
        )

        expect(selection.topPickId).toBeNull()
    })

    it('labels nothing when the composition named no date', () => {
        const selection = selectProductions(market, context, props({ max_items: 20 }))

        expect(selection.topPickId).toBeNull()
    })
})

describe('filter.city as a set', () => {
    // The capability the system prompt asked for and did not have: "within a
    // drive" is a set of cities, and one exact name could not say it.
    it('admits every city in the list', () => {
        const { groups } = selectProductions(market, context, props({
            filter: { city: ['Milwaukee', 'Detroit', 'Cleveland'] },
            group_by_geo: false,
            max_items: 7,
        }))

        const cities = new Set(groups.flatMap((group) => group.productions).map((item) => item.city))
        expect(cities).toEqual(new Set(['Milwaukee', 'Detroit', 'Cleveland']))
    })

    it('excludes a city outside the list even when it clears every other filter', () => {
        // Tampa at $88 is what actually shipped in a hero for a visitor who
        // said she would not fly. It passed the price filter; nothing else
        // could keep it out.
        const { groups } = selectProductions(market, context, props({
            filter: { max_price: 88, city: ['Chicago', 'Milwaukee', 'Detroit'] },
            group_by_geo: false,
            max_items: 7,
        }))

        const cities = groups.flatMap((group) => group.productions).map((item) => item.city)
        expect(cities).not.toContain('Tampa')
        expect(cities.length).toBeGreaterThan(0)
    })

    it('still takes a single city as a string', () => {
        const { groups } = selectProductions(market, context, props({
            filter: { city: 'Milwaukee' },
            group_by_geo: false,
            max_items: 7,
        }))

        const cities = new Set(groups.flatMap((group) => group.productions).map((item) => item.city))
        expect(cities).toEqual(new Set(['Milwaukee']))
    })

    it('renders nothing for a city with no dates, rather than failing', () => {
        const { groups } = selectProductions(market, context, props({
            filter: { city: ['Nowhere', 'Milwaukee'] },
            group_by_geo: false,
            max_items: 7,
        }))

        const cities = new Set(groups.flatMap((group) => group.productions).map((item) => item.city))
        expect(cities).toEqual(new Set(['Milwaukee']))
    })
})
