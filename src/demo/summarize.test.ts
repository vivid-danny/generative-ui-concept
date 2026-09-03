import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'
import { MARKET, VARIANTS } from '@/demo/variants'
import { PrecomputedProvider } from '@/orchestration/precomputed'

import { summarizeComposition } from './summarize'

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(leahBudget80)
const provider = new PrecomputedProvider()

describe('summarizeComposition', () => {
    it('reports the calendar day the card renders, not a timezone-shifted one', async () => {
        const { spec } = await provider.getLayout(context, market)
        const summary = summarizeComposition(spec, market, context)
        const rows = summary.groups.flatMap((group) => group.rows)

        expect(rows.length).toBeGreaterThan(0)

        for (const row of rows) {
            const production = market.productions.find((p) => p.id === row.id)!
            // The fixture stores venue-local wall-clock time. The summary must
            // agree with the day in that string, and with the card on the page.
            const expectedDay = Number(production.date.slice(8, 10))
            expect(Number(row.date.match(/(\d+)$/)![1]), `${row.id} (${production.date})`).toBe(
                expectedDay,
            )
        }
    })

    it('reports a shown/total tally that is true for every variant', async () => {
        for (const variant of VARIANTS) {
            const { spec } = await provider.getLayout(variant.context, MARKET)
            const summary = summarizeComposition(spec, MARKET, variant.context)

            expect(summary.total, variant.slug).toBe(MARKET.productions.length)
            expect(summary.shown, variant.slug).toBeLessThanOrEqual(summary.total)
            expect(summary.shown, variant.slug).toBe(
                summary.groups.reduce((count, group) => count + group.rows.length, 0),
            )
        }
    })

    it('keeps the shown/total tally true when max_items truncates', () => {
        // `filteredOut` counts only what the filter removed, so a spec that caps
        // the list must not be reported as hiding nothing.
        const spec = {
            layout: [
                {
                    module: 'production_list',
                    size: 'standard' as const,
                    props: { sort: 'date', highlight: null, group_by_geo: true, max_items: 2 },
                },
            ],
            reasoning: 'truncation case',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)

        expect(summary.shown).toBe(2)
        expect(summary.total).toBe(market.productions.length)
        expect(summary.filteredOut).toBe(0)
    })

    it('never marks a highlighted row that is not shown', async () => {
        for (const variant of VARIANTS) {
            const { spec } = await provider.getLayout(variant.context, MARKET)
            const summary = summarizeComposition(spec, MARKET, variant.context)
            const highlighted = summary.groups.flatMap((group) => group.rows).filter((row) => row.isHighlighted)

            expect(highlighted.length, variant.slug).toBeLessThanOrEqual(1)
        }
    })
})
