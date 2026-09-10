import { describe, expect, it } from 'vitest'

import { MarketSchema, type Production } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'

import { cardSignalFor, CARD_SIGNAL_IDS, CARD_SIGNALS } from './card-signal'

/**
 * Every signal here makes a claim about money, so what is worth testing is that
 * the number is read correctly and that the resting form is never blank — a
 * signal that vanishes on some rows is the one failure that makes a section look
 * broken rather than uninformative.
 */

const market = MarketSchema.parse(marketJson)

const row = (overrides: Partial<Production>): Production => ({
    ...market.productions[0],
    ...overrides,
})

describe('CARD_SIGNALS', () => {
    it('defines every id, and every definition agrees with its key', () => {
        for (const id of CARD_SIGNAL_IDS) {
            expect(CARD_SIGNALS[id]).toBeDefined()
            expect(CARD_SIGNALS[id].id).toBe(id)
        }

        expect(Object.keys(CARD_SIGNALS).sort()).toEqual([...CARD_SIGNAL_IDS].sort())
    })

    it('resolves to a non-empty label for every signal on every date', () => {
        // The comparability requirement, asserted directly: whatever a section
        // picks, all of its rows carry it.
        for (const id of CARD_SIGNAL_IDS) {
            for (const production of market.productions) {
                const value = cardSignalFor(production, id, market.productions)
                expect(value?.label, `${id} on ${production.id}`).toBeTruthy()
            }
        }
    })
})

describe('price_trend', () => {
    const trend = (price_trend_7d: number) =>
        cardSignalFor(row({ price_trend_7d }), 'price_trend', [])!

    it('reads a fall as a fall, rounded to whole percent, and calls it good news', () => {
        expect(trend(-0.04)).toEqual({ tone: 'good', label: '↓ 4% this week' })
        expect(trend(-0.126).label).toBe('↓ 13% this week')
    })

    it('reads a rise the same way, without dressing it as a warning', () => {
        expect(trend(0.06)).toEqual({ tone: 'neutral', label: '↑ 6% this week' })
    })

    it('calls anything inside a point either way steady', () => {
        // The band exists so a row never reads "↓ 0% this week", and so a
        // fabricated trend is not quoted to a precision it does not have.
        expect(trend(0).label).toBe('Steady')
        expect(trend(0.009).label).toBe('Steady')
        expect(trend(-0.009).label).toBe('Steady')

        expect(trend(0.01).label).toBe('↑ 1% this week')
        expect(trend(-0.01).label).toBe('↓ 1% this week')
    })
})

describe('price_gap_to_cheapest', () => {
    const set = [row({ id: 'a', floor_price: 54 }), row({ id: 'b', floor_price: 72 })]

    it('names the cheapest row rather than quoting it a gap of zero', () => {
        // The resting form is a recommendation, which is the point of this
        // signal: the row where the comparison says least is worth telling
        // someone about.
        expect(cardSignalFor(set[0], 'price_gap_to_cheapest', set)).toEqual({
            tone: 'good',
            label: 'Cheapest of these',
        })
    })

    it('quotes the gap in dollars for every other row', () => {
        expect(cardSignalFor(set[1], 'price_gap_to_cheapest', set)).toEqual({
            tone: 'neutral',
            label: '$18 over cheapest',
        })
    })

    it('compares against the section, not the tour', () => {
        // Indianapolis at $54 is the cheapest date on the whole tour, but a
        // Chicago-only section has its own cheapest — the slot compares within
        // the list the visitor is scanning.
        const chicago = market.productions.filter((production) => production.city === 'Chicago')
        const cheapestInChicago = Math.min(...chicago.map((production) => production.floor_price))
        const tourFloor = Math.min(...market.productions.map((production) => production.floor_price))

        expect(cheapestInChicago).toBeGreaterThan(tourFloor)

        const labels = chicago.map(
            (production) => cardSignalFor(production, 'price_gap_to_cheapest', chicago)!.label,
        )

        expect(labels).toContain('Cheapest of these')
    })
})

describe('typical_seat_price', () => {
    it('quotes the median listing to the nearest five dollars', () => {
        expect(cardSignalFor(row({ median_price: 212 }), 'typical_seat_price', [])!.label).toBe(
            'Typical seat ~$210',
        )
        expect(cardSignalFor(row({ median_price: 208 }), 'typical_seat_price', [])!.label).toBe(
            'Typical seat ~$210',
        )
    })

    it('thousands-separates, because tour floors reach three figures and listings more', () => {
        expect(cardSignalFor(row({ median_price: 1240 }), 'typical_seat_price', [])!.label).toBe(
            'Typical seat ~$1,240',
        )
    })

    it('reads as a spread against the row’s own get-in price', () => {
        // The reference point for this one is the button beside it, not the
        // other rows, so what matters is that the two numbers differ enough to
        // be worth showing.
        for (const production of market.productions) {
            const value = cardSignalFor(production, 'typical_seat_price', [])!

            expect(production.median_price, production.id).toBeGreaterThan(production.floor_price)
            expect(value.tone).toBe('neutral')
        }
    })

    it('has a spread worth showing on every date, and a varying one', () => {
        // The failure this guards is subtle and was real: a near-constant
        // multiple makes this signal a restatement of the number already in the
        // button. It looks informative and says nothing. See the spread section
        // in src/fixtures/README.md.
        const multiples = market.productions.map(
            (production) => production.median_price / production.floor_price,
        )
        const mean = multiples.reduce((total, m) => total + m, 0) / multiples.length
        const stdev = Math.sqrt(
            multiples.reduce((total, m) => total + (m - mean) ** 2, 0) / multiples.length,
        )

        // The designed band is 1.3-3.2, with a cent of slack because
        // `median_price` is rounded to a whole dollar after the multiply —
        // $54 x 3.2 rounds to $173, which reads back as 3.204.
        expect(Math.min(...multiples)).toBeGreaterThanOrEqual(1.29)
        expect(Math.max(...multiples)).toBeLessThanOrEqual(3.21)
        // Was 0.18 when the generator used a fixed multiplier.
        expect(stdev).toBeGreaterThan(0.4)
    })

    it('inverts the get-in ordering on the pair the fixture pins for it', () => {
        // The whole reason this signal exists. Indianapolis is the cheapest
        // get-in on the tour and Chicago's 12/05 is $22 more — but Indianapolis
        // has the widest spread on the tour and Chicago the narrowest typical
        // seat, so the button column and the signal column disagree about which
        // date is cheaper. See src/fixtures/README.md.
        const indianapolis = market.productions.find((p) => p.id === 'prod-004')!
        const chicago = market.productions.find((p) => p.id === 'prod-002')!

        expect(indianapolis.floor_price).toBeLessThan(chicago.floor_price)
        expect(indianapolis.median_price).toBeGreaterThan(chicago.median_price)

        expect(cardSignalFor(indianapolis, 'typical_seat_price', [])!.label).toBe(
            'Typical seat ~$175',
        )
        expect(cardSignalFor(chicago, 'typical_seat_price', [])!.label).toBe('Typical seat ~$125')
    })
})

describe('cardSignalFor', () => {
    it('shows nothing when the section did not ask for a signal', () => {
        expect(cardSignalFor(market.productions[0], null, market.productions)).toBeNull()
        expect(cardSignalFor(market.productions[0], undefined, market.productions)).toBeNull()
    })
})
