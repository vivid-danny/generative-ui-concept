import { describe, expect, it } from 'vitest'

import { MarketSchema, type Production } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'

import { BADGE_IDS, MAX_BADGES_PER_ROW, badgesFor } from './badges'

/**
 * The point of these is the split: the section says which badges are eligible,
 * the data says which rows get one. Getting that wrong in either direction is a
 * visible product bug — an allowlist that labels every card, or a badge that
 * never appears no matter what the orchestrator asks for.
 */

const market = MarketSchema.parse(marketJson)
const byCity = (city: string): Production =>
    market.productions.find((production) => production.city === city)!

describe('badgesFor', () => {
    it('shows nothing when the section allows nothing', () => {
        expect(badgesFor(byCity('Chicago'), [])).toEqual([])
    })

    it('shows a badge only when the section allows it', () => {
        const newlyAnnounced = market.productions.find((p) => p.announced_days_ago <= 7)!

        expect(badgesFor(newlyAnnounced, ['newly_released']).map((b) => b.id)).toEqual([
            'newly_released',
        ])
        expect(badgesFor(newlyAnnounced, ['fans_viewed']).map((b) => b.id)).not.toContain(
            'newly_released',
        )
    })

    it('does not label a row that does not qualify', () => {
        // The whole objection to a section-level badge: allowing "selling fast"
        // must not put it on dates that are not.
        const slow = market.productions.find((p) => p.sales_velocity < 0.7)!

        expect(badgesFor(slow, ['selling_fast'])).toEqual([])
    })

    it('labels the rows that do qualify', () => {
        const fast = market.productions.find((p) => p.sales_velocity >= 0.7)!

        expect(badgesFor(fast, ['selling_fast']).map((b) => b.id)).toEqual(['selling_fast'])
    })

    it('splits one allowlist across rows rather than applying it uniformly', () => {
        // Allowing everything should still produce a varied page.
        const counts = new Set(
            market.productions.map((production) => badgesFor(production, BADGE_IDS).length),
        )

        expect(counts.size).toBeGreaterThan(1)
    })

    it('caps a row at two, so a busy date is not a badge sentence', () => {
        for (const production of market.productions) {
            expect(badgesFor(production, BADGE_IDS).length).toBeLessThanOrEqual(MAX_BADGES_PER_ROW)
        }
    })

    it('leads with scarcity when a row qualifies for several', () => {
        const busy = market.productions.find(
            (p) => p.sellout_risk === 'high' && p.sales_velocity >= 0.7,
        )!

        expect(badgesFor(busy, BADGE_IDS)[0].id).toBe('tickets_left')
    })

    it('drops the least decisive signal when a row qualifies for three', () => {
        // With the cap at two, RENDER_ORDER decides which survive. A date that
        // is running out, moving fast and heavily viewed should say the first
        // two things, not the popularity one.
        const crowded = market.productions.find(
            (p) =>
                p.sellout_risk === 'high' && p.sales_velocity >= 0.7 && p.fans_viewed_24h >= 1500,
        )!
        const shown = badgesFor(crowded, BADGE_IDS).map((badge) => badge.id)

        expect(shown).toEqual(['tickets_left', 'selling_fast'])
        expect(shown).not.toContain('fans_viewed')
    })

    it('puts a real number in the copy rather than a score', () => {
        const viewed = market.productions.find((p) => p.fans_viewed_24h >= 1500)!
        const [badge] = badgesFor(viewed, ['fans_viewed'])

        expect(badge.label(viewed)).toBe(
            `${viewed.fans_viewed_24h.toLocaleString('en-US')} Fans Viewed`,
        )
    })

    it('keeps every badge reachable from some date in the snapshot', () => {
        // A badge no date can earn is dead vocabulary offered to the model.
        for (const id of BADGE_IDS) {
            const reachable = market.productions.some(
                (production) => badgesFor(production, [id]).length === 1,
            )
            expect(reachable, `${id} is unreachable in this fixture`).toBe(true)
        }
    })
})
