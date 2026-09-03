import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import { SpecProvenanceSchema, type ResolvedLayout } from '@/contracts/layout-spec'

import type { OrchestrationProvider } from './provider'
import { FALLBACK_LAYOUT, validateLayout } from './validate'

import leahBudget80 from './specs/leah-onsale-budget-80.json'
import leahBudget250 from './specs/leah-onsale-budget-250.json'
import leahNoBudget from './specs/leah-onsale-no-budget.json'

/**
 * Stage 1 orchestration: a library of layout specs composed by Claude during
 * development, keyed by context.
 *
 * These are real LLM composition decisions, made ahead of time rather than at
 * request time — which is why every spec ships with the provenance record that
 * says so. Without it, "an LLM composed this" would be an unverifiable claim.
 */

const SPEC_LIBRARY: Record<string, unknown> = {
    'leah_onsale/budget_80': leahBudget80,
    'leah_onsale/budget_250': leahBudget250,
    'leah_onsale/no_budget': leahNoBudget,
}

/**
 * The library key for a context. Budget is the only dimension slice 1 varies, so
 * it is the only one keyed on; later slices key on entry intent and device too.
 */
export function specKeyFor(context: Context): string {
    const budget = context.stated_budget
    const bucket = budget === null ? 'no_budget' : budget <= 150 ? 'budget_80' : 'budget_250'
    return `${context.persona_id}/${bucket}`
}

export class PrecomputedProvider implements OrchestrationProvider {
    readonly name = 'Precomputed (composed by Claude during development)'
    readonly isLive = false

    async getLayout(context: Context, market: Market): Promise<ResolvedLayout> {
        const key = specKeyFor(context)
        const entry = SPEC_LIBRARY[key] as
            | { spec: unknown; provenance: unknown }
            | undefined

        if (!entry) {
            return {
                spec: FALLBACK_LAYOUT,
                provenance: SpecProvenanceSchema.parse({
                    generated_at: new Date().toISOString(),
                    source: 'fallback',
                    model: null,
                    prompt_version: null,
                    context_id: key,
                    raw_response: null,
                }),
                notes: [{ level: 'fallback', reason: `no precomputed spec for \`${key}\`` }],
            }
        }

        const { spec, notes } = validateLayout(entry.spec, market)
        return {
            spec,
            provenance: SpecProvenanceSchema.parse(entry.provenance),
            notes,
        }
    }
}
