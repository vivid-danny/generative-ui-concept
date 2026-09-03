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
    it('shows every date when nothing is filtered', () => {
        const selection = selectProductions(market, context, props({ max_items: 20 }))

        expect(allDates(selection)).toHaveLength(market.productions.length)
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
