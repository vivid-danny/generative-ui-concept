import { describe, expect, it } from 'vitest'

import { MarketSchema, type Production } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'

import { cardSignalFor, priceTrendFor } from './trend'

/**
 * The signal makes a claim about a number, so what is worth testing is that the
 * number is read correctly and that the flat band is where we said it is —
 * "↓ 0% this week" would be worse than showing nothing.
 */

const market = MarketSchema.parse(marketJson)

const dateWithTrend = (price_trend_7d: number): Production => ({
    ...market.productions[0],
    price_trend_7d,
})

describe('priceTrendFor', () => {
    it('reads a fall as a fall, rounded to whole percent', () => {
        expect(priceTrendFor(dateWithTrend(-0.04))).toEqual({
            direction: 'down',
            label: '↓ 4% this week',
        })
        expect(priceTrendFor(dateWithTrend(-0.126)).label).toBe('↓ 13% this week')
    })

    it('reads a rise the same way, without dressing it as a warning', () => {
        expect(priceTrendFor(dateWithTrend(0.06))).toEqual({
            direction: 'up',
            label: '↑ 6% this week',
        })
    })

    it('calls anything inside a point either way steady', () => {
        // The band exists so the row never reads "↓ 0% this week", and so a
        // fabricated trend is not quoted to a precision it does not have.
        expect(priceTrendFor(dateWithTrend(0)).label).toBe('Steady')
        expect(priceTrendFor(dateWithTrend(0.009)).label).toBe('Steady')
        expect(priceTrendFor(dateWithTrend(-0.009)).label).toBe('Steady')

        expect(priceTrendFor(dateWithTrend(0.01)).direction).toBe('up')
        expect(priceTrendFor(dateWithTrend(-0.01)).direction).toBe('down')
    })

    it('renders on every date, including the flat ones', () => {
        // The whole difference from a badge: a signal that disappeared on some
        // rows would make the section look inconsistent rather than informative.
        for (const production of market.productions) {
            expect(priceTrendFor(production).label).not.toBe('')
        }
    })
})

describe('cardSignalFor', () => {
    it('shows nothing when the section did not ask for a signal', () => {
        expect(cardSignalFor(market.productions[0], null)).toBeNull()
    })

    it('shows the trend when it did', () => {
        expect(cardSignalFor(market.productions[0], 'price_trend')).toEqual(
            priceTrendFor(market.productions[0]),
        )
    })
})
