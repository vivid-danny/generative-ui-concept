import { describe, expect, it } from 'vitest'

import { MARKET } from '@/demo/modes'
import { PERSONAS as VARIANTS, type Persona } from '@/fixtures/personas'
import { selectProductions, type ProductionListProps } from '@/modules/production-list/select'
import { PrecomputedProvider } from '@/orchestration/precomputed'

/**
 * Composition evals — source plan §7.
 *
 * These assert *properties* of a composition, not exact layouts: an orchestrator
 * that produces a different-but-sensible page should pass, while one that
 * ignores the context should fail.
 *
 * The first test is the important one. Convergence — emitting the same safe
 * layout for every visitor — is the most likely failure mode of LLM composition,
 * and it is invisible to every other test in the suite because each individual
 * spec is perfectly valid. Without this, the prototype could pass its whole test
 * suite while failing its entire premise.
 */

const provider = new PrecomputedProvider()

async function resolveAll() {
    return Promise.all(
        VARIANTS.map(async (variant: Persona) => ({
            variant,
            resolved: await provider.getLayout(variant.context, MARKET),
        })),
    )
}

describe('composition evals', () => {
    it('does not converge: different contexts produce different compositions', async () => {
        const results = await resolveAll()
        const fingerprints = new Set(
            results.map((result) => JSON.stringify(result.resolved.spec.layout)),
        )

        expect(fingerprints.size).toBe(VARIANTS.length)
    })

    it('does not converge on what actually renders, either', async () => {
        // Two specs could differ in props that make no visible difference. This
        // checks the rendered rows, which is what a viewer actually judges.
        const results = await resolveAll()

        const rendered = results.map((result) => {
            const entry = result.resolved.spec.layout.find((item) => item.module === 'production_list')!
            const selection = selectProductions(
                MARKET,
                result.variant.context,
                entry.props as unknown as ProductionListProps,
            )
            return JSON.stringify(
                selection.groups.map((group) => [group.label, group.productions.map((p) => p.id)]),
            )
        })

        expect(new Set(rendered).size).toBeGreaterThan(1)
    })

    it('every composition keeps a path to purchase', async () => {
        const results = await resolveAll()

        for (const { variant, resolved } of results) {
            const hasList = resolved.spec.layout.some((entry) =>
                ['production_list', 'listing_preview'].includes(entry.module),
            )
            expect(hasList, `${variant.slug} has no path to purchase`).toBe(true)
        }
    })

    it('a stated budget constrains what the page shows', async () => {
        const results = await resolveAll()

        for (const { variant, resolved } of results) {
            const budget = variant.context.stated_budget
            if (budget === null) continue

            const entry = resolved.spec.layout.find((item) => item.module === 'production_list')!
            const selection = selectProductions(
                MARKET,
                variant.context,
                entry.props as unknown as ProductionListProps,
            )
            const shown = selection.groups.flatMap((group) => group.productions)

            // Not "every price is under budget" — a $250 visitor should still see
            // the whole slate. The requirement is weaker and more honest: nothing
            // shown may be unreachable at the stated budget.
            expect(
                shown.every((production) => production.floor_price <= budget),
                `${variant.slug} shows a date whose cheapest ticket is over $${budget}`,
            ).toBe(true)
        }
    })

    it('a tight budget leads the page more forcefully than a loose one', async () => {
        const [tight, loose] = await Promise.all([
            provider.getLayout(VARIANTS[0].context, MARKET),
            provider.getLayout(VARIANTS[1].context, MARKET),
        ])

        const sizeOf = (resolved: Awaited<ReturnType<typeof provider.getLayout>>) =>
            resolved.spec.layout.find((entry) => entry.module === 'production_list')?.size

        // $80 is a constraint the page has to answer; $250 is a browse.
        expect(sizeOf(tight)).toBe('hero')
        expect(sizeOf(loose)).toBe('standard')
    })

    it('declines to recommend when it knows nothing about price tolerance', async () => {
        const noBudget = VARIANTS.find((variant) => variant.context.stated_budget === null)!
        const resolved = await provider.getLayout(noBudget.context, MARKET)
        const entry = resolved.spec.layout.find((item) => item.module === 'production_list')!

        expect(entry.props.highlight).toBeNull()
        expect(entry.props.filter).toBeUndefined()
    })

    it('every spec explains itself', async () => {
        const results = await resolveAll()

        for (const { variant, resolved } of results) {
            // `reasoning` is the demo's "why this page" reveal and the first
            // thing consulted when a composition looks wrong — a one-word
            // placeholder would satisfy the schema and defeat the purpose.
            expect(resolved.spec.reasoning.length, variant.slug).toBeGreaterThan(80)
        }
    })

    it('every precomputed spec carries inspectable provenance', async () => {
        const results = await resolveAll()

        for (const { variant, resolved } of results) {
            const { provenance } = resolved
            expect(provenance.source, variant.slug).toBe('precomputed')
            expect(provenance.model, variant.slug).toBeTruthy()
            expect(provenance.prompt_version, variant.slug).toBeTruthy()
            expect(provenance.raw_response, variant.slug).toBeTruthy()
        }
    })

    it('no precomputed spec needs repairing — the library is clean', async () => {
        const results = await resolveAll()

        for (const { variant, resolved } of results) {
            expect(resolved.notes, `${variant.slug}: ${JSON.stringify(resolved.notes)}`).toEqual([])
        }
    })
})
