import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'
import { MARKET } from '@/demo/modes'
import { PERSONAS as VARIANTS } from '@/fixtures/personas'
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

describe('summarizeComposition with repeated sections', () => {
    const section = (heading: string, city?: string) => ({
        module: 'production_list',
        size: 'standard' as const,
        props: {
            heading,
            sort: 'date',
            highlight: null,
            group_by_geo: false,
            max_items: 20,
            ...(city ? { filter: { city } } : {}),
        },
    })

    const spec = {
        layout: [section('In Chicago', 'Chicago'), section('Worth the drive', 'Milwaukee')],
        reasoning: 'sections',
        headline: null,
    }

    it('summarises every instance, not just the first', () => {
        // Reading only the first list would show a fraction of the page in the
        // panel, which is the one place the composition gets inspected.
        const summary = summarizeComposition(spec, market, context)

        expect(summary.groups.map((group) => group.label)).toEqual([
            'In Chicago',
            'Worth the drive',
        ])
    })

    it('labels each section by its own heading', () => {
        const summary = summarizeComposition(spec, market, context)

        expect(summary.groups[0].rows.every((row) => row.city === 'Chicago')).toBe(true)
        expect(summary.groups[1].rows.every((row) => row.city === 'Milwaukee')).toBe(true)
    })

    it('counts a date once even if two sections show it', () => {
        const overlapping = {
            ...spec,
            layout: [section('In Chicago', 'Chicago'), section('Also Chicago', 'Chicago')],
        }
        const summary = summarizeComposition(overlapping, market, context)
        const chicagoDates = market.productions.filter((p) => p.city === 'Chicago').length

        expect(summary.shown).toBe(chicagoDates)
    })

    it('counts a date as filtered out only when no section admits it', () => {
        const summary = summarizeComposition(spec, market, context)
        const admitted = market.productions.filter(
            (p) => p.city === 'Chicago' || p.city === 'Milwaukee',
        ).length

        expect(summary.filteredOut).toBe(market.productions.length - admitted)
    })

    it('lists a repeated module once per instance', () => {
        const summary = summarizeComposition(spec, market, context)

        expect(summary.modules).toHaveLength(2)
    })
})

describe('summarizeComposition — no date twice, empty sections reported', () => {
    const section = (heading: string, props: Record<string, unknown> = {}) => ({
        module: 'production_list',
        size: 'standard' as const,
        props: {
            heading,
            sort: 'date',
            highlight: null,
            group_by_geo: false,
            max_items: 20,
            ...props,
        },
    })

    it('does not show the same date in two sections', () => {
        // The bug this exists for: a "weekend road trip" section repeated the
        // visitor's own Chicago night, which makes the page look like padding.
        const spec = {
            layout: [
                section('In Chicago', { filter: { city: 'Chicago' } }),
                section('Weekend trips', { filter: { day_type: 'weekend', max_price: 80 } }),
            ],
            reasoning: 'overlapping filters',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)
        const ids = summary.groups.flatMap((group) => group.rows.map((row) => row.id))

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('gives the date to the first section that claims it', () => {
        const spec = {
            layout: [
                section('First claim', { filter: { city: 'Chicago' } }),
                section('Second', { filter: { city: 'Chicago' } }),
            ],
            reasoning: 'both want Chicago',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)

        expect(summary.groups.map((group) => group.label)).toEqual(['First claim'])
    })

    it('reports a section left empty because another took its dates', () => {
        const spec = {
            layout: [
                section('First claim', { filter: { city: 'Chicago' } }),
                section('Second', { filter: { city: 'Chicago' } }),
            ],
            reasoning: 'both want Chicago',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)

        expect(summary.emptySections).toEqual([
            { heading: 'Second', reason: 'already shown above' },
        ])
    })

    it('distinguishes an empty section from one whose filter matched nothing', () => {
        const spec = {
            layout: [section('Impossible', { filter: { max_price: 1 } })],
            reasoning: 'nothing is this cheap',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)

        expect(summary.emptySections).toEqual([{ heading: 'Impossible', reason: 'no matches' }])
    })

    it('does not count a claimed date against the filter', () => {
        // `filteredOut` says "removed by a filter". A date another section is
        // already showing was not filtered out of the page.
        const spec = {
            layout: [
                section('First', { filter: { city: 'Chicago' } }),
                section('Rest', {}),
            ],
            reasoning: 'first claims Chicago',
            headline: null,
        }
        const summary = summarizeComposition(spec, market, context)

        expect(summary.filteredOut).toBe(0)
    })
})
