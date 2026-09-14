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
    /**
     * The one date the composition recommends, by production id.
     *
     * Page-level rather than a `production_list` prop, because "one
     * recommendation per page" is a property of the page. Putting it here makes
     * that true by construction instead of something the validator has to strip
     * back to one, and it removes any question of which section owns the pick
     * when several are placed.
     *
     * Checked against the snapshot by the validator, and honoured by whichever
     * section actually shows that date — see `selectProductions`.
     */
    top_pick: z.string().nullable().default(null),
    /**
     * One or two sentences saying *why* that date is the pick, shown on hover
     * over the "Top Pick" tab.
     *
     * The first model-written prose a visitor reads. Every other string the
     * model writes is a *framing* — a heading, a headline — but this one states
     * reasons, and a reason is made of facts. Nothing downstream can check
     * whether they are true: the bounds below constrain shape and length, and
     * the system prompt carries the rest (say what you like about why; every
     * fact must come from the snapshot you were given).
     *
     * Why the bounds are what they are:
     *
     * - **40 floor.** Stops "Best value." — a chip that explains nothing is
     *   worse than a chip with no tooltip, because the visitor spent a hover on
     *   it.
     * - **240 ceiling.** Two sentences with room to be specific. A tooltip is
     *   not a paragraph, and the reasoning the model already writes in
     *   `reasoning` shows it will fill any space it is given.
     * - **Single line, no markup.** Rejected rather than stripped — a reason
     *   arriving as a bullet list means the model misunderstood the slot, and
     *   quietly reshaping it would hide that.
     *
     * Required whenever `top_pick` is set, enforced in the validator because it
     * is a rule about the pair rather than about either field.
     */
    /**
     * Where the composition believes the visitor is, by city name.
     *
     * The context carries a `geo.metro`, but it is a geo-IP guess and the brief
     * outranks it — `buildMessage` says so outright ("where the two disagree,
     * the description wins"). The problem was that only the *model* got that
     * memo: `selectProductions` groups dates by `context.geo.metro` and the
     * section header prints it, so a page composed for Los Angeles off an LA
     * brief still headed its near-group "Near Chicago".
     *
     * The model was getting the right answer by avoiding the question —
     * switching `group_by_geo` off whenever the brief disagreed with the geo.
     * That is a composition constrained by a rendering limitation, which is
     * backwards, and it only held as long as it kept choosing to sidestep.
     *
     * So the spec carries the city and the renderer prefers it. Page-level for
     * the same reason as `top_pick`: one visitor, one location, not a per-section
     * prop that could contradict itself. Null means "nothing better than the
     * context" — which is the baseline's case, since it composes nothing.
     *
     * Checked against the snapshot by the validator: a city no date is in
     * cannot group anything, and would print a header naming a place the page
     * does not show.
     */
    visitor_metro: z.string().nullable().default(null),
    top_pick_reason: z
        .string()
        .trim()
        .min(40)
        .max(240)
        .refine((text) => !text.includes('\n'), { message: 'must be a single line' })
        .refine((text) => !/[*_`#<>|]/.test(text), { message: 'must be plain prose' })
        .nullable()
        .default(null),
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
