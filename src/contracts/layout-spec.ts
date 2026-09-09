import { z } from 'zod'

import { SizeSchema } from './module-catalog'

/**
 * Layout spec — source plan §3.4. This is the orchestrator's entire output: the
 * LLM emits structure, never code.
 *
 * Deliberately permissive at the shape level. `module` is a plain string and
 * `props` is an open record, because the point of the validator is to *catch*
 * hallucinated modules and bad props and repair them — a schema strict enough to
 * reject them here would throw away an otherwise good composition and lose the
 * information about what went wrong.
 */

export const LayoutEntrySchema = z.object({
    module: z.string().min(1),
    size: SizeSchema.optional(),
    props: z.record(z.unknown()).default({}),
})

export const LayoutSpecSchema = z.object({
    layout: z.array(LayoutEntrySchema),
    /** Required: demo material and the primary debugging tool (§7). */
    reasoning: z.string().min(1),
    headline: z.string().nullable().default(null),
})

export type LayoutEntry = z.infer<typeof LayoutEntrySchema>
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>

/**
 * Where a spec came from. Kept alongside every precomputed spec so the claim
 * "an LLM composed this" is inspectable rather than asserted — the specs in
 * slice 1 are generated during development, not at request time, and this record
 * is what makes that honest.
 */
export const SpecProvenanceSchema = z.object({
    generated_at: z.string().min(1),
    /** 'precomputed' today; 'live' once orchestration runs at request time. */
    source: z.enum(['precomputed', 'live', 'fallback']),
    model: z.string().nullable(),
    prompt_version: z.string().nullable(),
    context_id: z.string().min(1),
    /** The model's unparsed response, verbatim. Null for the static fallback. */
    raw_response: z.string().nullable(),
    /**
     * What the call cost and how long it took. Only meaningful for `live`;
     * optional so the precomputed spec files on disk stay valid unchanged.
     */
    cost_usd: z.number().nullable().default(null),
    duration_ms: z.number().nullable().default(null),
    /** Input tokens billed for the call — the number that drives the cost. */
    input_tokens: z.number().nullable().default(null),
})

export type SpecProvenance = z.infer<typeof SpecProvenanceSchema>

/** A spec plus its provenance — what a provider actually returns. */
export interface ResolvedLayout {
    spec: LayoutSpec
    provenance: SpecProvenance
    /** Every repair or drop the validator applied. Surfaced in the demo. */
    notes: ValidationNote[]
}

export interface ValidationNote {
    level: 'dropped' | 'repaired' | 'fallback'
    module?: string
    reason: string
}
