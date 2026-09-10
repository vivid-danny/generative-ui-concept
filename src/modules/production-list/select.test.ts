import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import { MODULE_CATALOG } from '@/contracts/module-catalog'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'

import { selectProductions, type ProductionListProps } from './select'

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

    it('highlights the cheapest date when the composition asks for it', () => {
        const selection = selectProductions(market, context, props({ highlight: 'cheapest', max_items: 20 }))
        const cheapest = [...market.productions].sort((a, b) => a.floor_price - b.floor_price)[0]

        expect(selection.highlightedId).toBe(cheapest.id)
    })

    it('highlights best value on median price, which is a different date than cheapest', () => {
        const byValue = selectProductions(market, context, props({ highlight: 'best_value', max_items: 20 }))
        const byPrice = selectProductions(market, context, props({ highlight: 'cheapest', max_items: 20 }))

        // Worth asserting: if these ever coincide, the two highlight modes stop
        // being meaningfully different choices for the orchestrator.
        expect(byValue.highlightedId).not.toBe(byPrice.highlightedId)
    })

    it('highlights nothing when the composition declines to recommend', () => {
        const selection = selectProductions(market, context, props({ highlight: null }))

        expect(selection.highlightedId).toBeNull()
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

    it('only highlights a date that is actually visible', () => {
        // The cheapest date overall is Indianapolis; restrict to Chicago and the
        // highlight has to move rather than point at a row that is not rendered.
        const selection = selectProductions(
            market,
            context,
            props({ filter: { city: 'Chicago' }, highlight: 'cheapest', max_items: 20 }),
        )
        const visibleIds = allDates(selection).map((production) => production.id)

        expect(visibleIds).toContain(selection.highlightedId)
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

    it('highlights on value score rather than typical price', () => {
        const selection = selectProductions(
            market,
            context,
            props({ highlight: 'best_value', group_by_geo: false, max_items: 52 }),
        )
        const best = [...market.productions].sort((a, b) => b.value_score - a.value_score)[0]

        expect(selection.highlightedId).toBe(best.id)
    })

    it('still distinguishes best value from cheapest', () => {
        const byValue = selectProductions(
            market,
            context,
            props({ highlight: 'best_value', group_by_geo: false, max_items: 52 }),
        )
        const byPrice = selectProductions(
            market,
            context,
            props({ highlight: 'cheapest', group_by_geo: false, max_items: 52 }),
        )

        expect(byValue.highlightedId).not.toBe(byPrice.highlightedId)
    })
})
