import { describe, expect, it } from 'vitest'

import { MarketSchema, type Market } from '@/contracts/market'
import { MODULE_CATALOG } from '@/contracts/module-catalog'
import marketJson from '@/fixtures/market.json'

import {
    CARD_HEADING,
    MAX_FACTS,
    MAX_METRICS,
    resolveSignals,
    STAT_IDS,
    STATS,
    type MarketSignalsProps,
    type StatId,
} from './signals'

/**
 * The card's whole claim is that its numbers are ours and true. So most of
 * these assert an actual figure against the fixture — which makes them fixture
 * invariants as much as unit tests (see `src/fixtures/README.md`).
 *
 * The rest cover the contract the orchestrator is working against: naming a
 * stat is a request, not a guarantee.
 */

const market = MarketSchema.parse(marketJson)

/** Props as the validator would hand them over — schema defaults applied. */
function props(overrides: Partial<MarketSignalsProps> = {}): MarketSignalsProps {
    return {
        ...(MODULE_CATALOG.market_signals.propsSchema.parse({}) as MarketSignalsProps),
        ...overrides,
    }
}

/** A market of one date, so a band or an `applies` can be aimed precisely. */
function marketOf(overrides: Partial<Market['productions'][number]>[]): Market {
    return {
        ...market,
        productions: overrides.map((override, index) => ({
            ...market.productions[0],
            id: `synthetic-${index}`,
            ...override,
        })),
    }
}

const metric = (id: StatId, on: Market = market) =>
    resolveSignals(on, props({ stats: [id] })).metrics[0]
const fact = (id: StatId, on: Market = market) => resolveSignals(on, props({ stats: [id] })).facts[0]

describe('STATS', () => {
    it('defines every id, and every definition agrees with its key', () => {
        // The drift `badges.ts` has no guard against: a definition whose `id`
        // does not match its key silently mislabels whatever reads it back.
        for (const id of STAT_IDS) {
            expect(STATS[id]).toBeDefined()
            expect(STATS[id].id).toBe(id)
        }

        expect(Object.keys(STATS).sort()).toEqual([...STAT_IDS].sort())
    })
})

describe('CARD_HEADING', () => {
    it('is fixed, and general enough to be true of any stat mix', () => {
        // Not a prop: the orchestrator already writes every section heading in
        // the main column, and the title has to hold whether the stats are about
        // price, demand or inventory.
        expect(CARD_HEADING).toBe('Event Trends')
    })
})

describe('resolveSignals — the default card', () => {
    it('is the shape of the Figma frame: two metrics over three facts', () => {
        const resolved = resolveSignals(market, props())

        expect(resolved.metrics.map((m) => m.id)).toEqual(['fan_demand', 'lowest_price'])
        expect(resolved.facts.map((f) => f.id)).toEqual([
            'selling_out',
            'fans_viewing',
            'tour_scale',
        ])
    })
})

describe('resolveSignals — the numbers', () => {
    it('reads demand as a level', () => {
        // Mean demand_score across the 52 dates is 0.736.
        expect(metric('fan_demand')).toMatchObject({ label: 'Fan demand', value: 'High' })
    })

    it('reads the tour floor and the typical get-in price', () => {
        expect(metric('lowest_price').value).toBe('$54')
        // Median of the *floor* prices, 98.5, rounded. Deliberately not
        // `median_price`, which would answer a different question than the label.
        expect(metric('typical_price').value).toBe('$99')
    })

    it('reads the week as a direction', () => {
        // Mean price_trend_7d is -0.0063: past the -0.005 boundary, so easing.
        expect(metric('price_direction')).toMatchObject({
            label: 'Prices this week',
            value: 'Easing',
        })
    })

    it('counts the dates at real risk of selling out', () => {
        expect(fact('selling_out').text).toBe('19 dates are selling out fast')
    })

    it('sums the viewer counts rather than quoting a made-up one', () => {
        // Replaces the hardcoded "343 Fans shopping tickets now" the rail used
        // to carry. Much larger, because it is 52 dates' worth of real field.
        expect(fact('fans_viewing').text).toBe('121,821 fans viewed in the last 24 hours')
    })

    it('states the size of the run and the inventory behind it', () => {
        expect(fact('tour_scale').text).toBe('52 tour dates in 36 cities')
        expect(fact('tickets_available').text).toBe('59,564 tickets available on the tour')
    })
})

describe('resolveSignals — band boundaries', () => {
    it('puts demand in the band it lands on, boundaries included', () => {
        const at = (demand_score: number) =>
            metric('fan_demand', marketOf([{ demand_score }])).value

        expect(at(0.81)).toBe('Very high')
        expect(at(0.8)).toBe('Very high')
        expect(at(0.79)).toBe('High')
        expect(at(0.65)).toBe('High')
        expect(at(0.64)).toBe('Steady')
        expect(at(0.45)).toBe('Steady')
        expect(at(0.44)).toBe('Quiet')
        expect(at(0)).toBe('Quiet')
    })

    it('reads the price direction either side of flat', () => {
        const at = (price_trend_7d: number) =>
            metric('price_direction', marketOf([{ price_trend_7d }])).value

        expect(at(0.06)).toBe('Rising')
        expect(at(0.03)).toBe('Rising')
        expect(at(0.01)).toBe('Edging up')
        expect(at(0.005)).toBe('Edging up')
        // The flat band is deliberately narrow and asymmetric at its edges:
        // -0.005 still reads as steady, anything below it as easing.
        expect(at(0)).toBe('Holding steady')
        expect(at(-0.005)).toBe('Holding steady')
        expect(at(-0.006)).toBe('Easing')
        expect(at(-0.03)).toBe('Easing')
        expect(at(-0.09)).toBe('Falling')
    })
})

describe('resolveSignals — naming a stat is a request, not a guarantee', () => {
    it('keeps the orchestrator’s order', () => {
        const resolved = resolveSignals(
            market,
            props({ stats: ['tour_scale', 'typical_price', 'selling_out', 'fan_demand'] }),
        )

        expect(resolved.metrics.map((m) => m.id)).toEqual(['typical_price', 'fan_demand'])
        expect(resolved.facts.map((f) => f.id)).toEqual(['tour_scale', 'selling_out'])
    })

    it('collapses a stat named twice', () => {
        const resolved = resolveSignals(market, props({ stats: ['selling_out', 'selling_out'] }))

        expect(resolved.facts.map((f) => f.id)).toEqual(['selling_out'])
    })

    it('drops what is past the cap rather than overflowing the card', () => {
        const resolved = resolveSignals(
            market,
            props({
                stats: [
                    'fan_demand',
                    'lowest_price',
                    'typical_price',
                    'selling_out',
                    'fans_viewing',
                ],
            }),
        )

        expect(resolved.metrics).toHaveLength(MAX_METRICS)
        expect(resolved.facts.length).toBeLessThanOrEqual(MAX_FACTS)
        // `typical_price` asked for a third metric slot and does not get one.
        expect(resolved.metrics.map((m) => m.id)).not.toContain('typical_price')
    })

    it('drops a stat with nothing behind it, and keeps the rest', () => {
        const calm = marketOf([{ sellout_risk: 'low' }, { sellout_risk: 'moderate' }])
        const resolved = resolveSignals(calm, props({ stats: ['selling_out', 'tour_scale'] }))

        expect(resolved.facts.map((f) => f.id)).toEqual(['tour_scale'])
    })

    it('still carries demand and price when every requested stat drops', () => {
        // The facts all drop, so the card is left with the two readings it is
        // required to have rather than with nothing. A card the orchestrator
        // placed has something to say about what a ticket costs.
        const quiet = marketOf([{ sellout_risk: 'low', fans_viewed_24h: 0 }])
        const resolved = resolveSignals(quiet, props({ stats: ['selling_out', 'fans_viewing'] }))

        expect(resolved.metrics.map((m) => m.id)).toEqual(['fan_demand', 'lowest_price'])
        expect(resolved.facts).toHaveLength(0)
    })

    describe('the two metric slots are one demand reading and one price reading', () => {
        it('fills the price slot when only demand was asked for', () => {
            // The v7 run: fan_demand and two facts, leaving the card silent on
            // price beside a main column arguing about $76 against $125.
            const resolved = resolveSignals(
                market,
                props({ stats: ['fan_demand', 'selling_out', 'fans_viewing'] }),
            )

            expect(resolved.metrics.map((m) => m.id)).toEqual(['fan_demand', 'lowest_price'])
        })

        it('fills the demand slot when only price was asked for, and price still leads', () => {
            const resolved = resolveSignals(market, props({ stats: ['typical_price'] }))

            expect(resolved.metrics.map((m) => m.id)).toEqual(['typical_price', 'fan_demand'])
        })

        it('honours which price reading was asked for', () => {
            const resolved = resolveSignals(market, props({ stats: ['price_direction'] }))

            expect(resolved.metrics.map((m) => m.id)).toContain('price_direction')
            expect(resolved.metrics.map((m) => m.id)).not.toContain('lowest_price')
        })

        it('spends the second slot on demand rather than a second price reading', () => {
            const resolved = resolveSignals(
                market,
                props({ stats: ['lowest_price', 'typical_price'] }),
            )

            expect(resolved.metrics.map((m) => m.id)).toEqual(['lowest_price', 'fan_demand'])
        })

        it('keeps the orchestrator order when it asked for both', () => {
            const resolved = resolveSignals(market, props({ stats: ['lowest_price', 'fan_demand'] }))

            expect(resolved.metrics.map((m) => m.id)).toEqual(['lowest_price', 'fan_demand'])
        })
    })
})
