import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import { SpecProvenanceSchema, type ResolvedLayout } from '@/contracts/layout-spec'
import { MODULE_CATALOG, type ModuleId } from '@/contracts/module-catalog'

import { callModel } from './bridge'
import { PrecomputedProvider, specKeyFor } from './precomputed'
import type { OrchestrationProvider } from './provider'
import { validateLayout } from './validate'

/**
 * Live orchestration — the composition happens at request time.
 *
 * This is the whole point of the `OrchestrationProvider` seam: the renderer, the
 * validator, the contracts and the modules are all unchanged, and the only
 * difference from `PrecomputedProvider` is where the layout spec comes from.
 *
 * Two deliberate choices:
 *
 * - The model's output goes through the same `validateLayout` as everything else.
 *   Its drop/repair/fallback behaviour was written for exactly this — a
 *   hallucinated module or an out-of-range prop is now a live possibility rather
 *   than a hypothetical.
 * - When the call fails, we fall back to the *precomputed* spec for this context
 *   rather than the static fallback layout, and say so. The page still looks
 *   composed, and provenance never claims `live` for something the model did not
 *   produce.
 */

/** What the orchestrator is allowed to place, rendered for the prompt. */
function catalogForPrompt(): string {
    return (Object.keys(MODULE_CATALOG) as ModuleId[])
        .filter((id) => MODULE_CATALOG[id].orchestrated && MODULE_CATALOG[id].implemented)
        .map((id) => {
            const module = MODULE_CATALOG[id]
            return [
                `- \`${id}\` (${module.lever} lever)`,
                `  purpose: ${module.purpose}`,
                `  sizes: ${module.sizes.join(' | ')} (default ${module.defaultSize})`,
                // Without the props, the model invents names that are close but
                // wrong (`sort_by` for `sort`) and the validator has to strip
                // them, discarding intent it could have expressed correctly.
                `  props:`,
                module.propsHint
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n'),
            ].join('\n')
        })
        .join('\n')
}

/**
 * The user half of the request. The system half is `orchestrator/prompt.md`,
 * supplied by the bridge — this adds only the per-request material.
 *
 * The catalog is generated from `MODULE_CATALOG` rather than written out here,
 * so a module can never be offered to the model that the registry cannot render.
 */
export function buildMessage(context: Context, market: Market): string {
    return `Compose the page for this visitor.

## Modules you may place

${catalogForPrompt()}

Other modules exist in the catalog but are not implemented yet — do not place
them. \`event_header\` is page chrome and is never yours to place.

## Context (who is landing)

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## Market snapshot (the inventory that exists)

\`\`\`json
${JSON.stringify(market, null, 2)}
\`\`\`

Reply with the layout spec object and nothing else — no prose, no code fence.`
}

/**
 * Pulls the layout spec out of the model's reply.
 *
 * Tries the whole string first, then the outermost balanced-brace substring, so
 * a reply wrapped in prose or a fenced code block still parses. Returns null
 * when nothing usable is there — the caller treats that as a failed call rather
 * than guessing.
 */
export function extractLayoutSpec(text: string): unknown | null {
    const attempt = (candidate: string): unknown | null => {
        try {
            const parsed = JSON.parse(candidate)
            return parsed !== null && typeof parsed === 'object' ? parsed : null
        } catch {
            return null
        }
    }

    const direct = attempt(text.trim())
    if (direct) return direct

    // Walk the string tracking brace depth, ignoring braces inside strings, and
    // take the first top-level {...}. Regex cannot do this — layout specs nest.
    const start = text.indexOf('{')
    if (start === -1) return null

    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < text.length; i++) {
        const char = text[i]

        if (escaped) {
            escaped = false
            continue
        }
        if (char === '\\') {
            escaped = true
            continue
        }
        if (char === '"') {
            inString = !inString
            continue
        }
        if (inString) continue

        if (char === '{') depth++
        else if (char === '}') {
            depth--
            if (depth === 0) return attempt(text.slice(start, i + 1))
        }
    }

    return null
}

export class LiveProvider implements OrchestrationProvider {
    readonly name = 'Live (composed at request time by Claude)'
    readonly isLive = true

    async getLayout(context: Context, market: Market): Promise<ResolvedLayout> {
        const contextId = specKeyFor(context)

        try {
            const call = await callModel(buildMessage(context, market))
            const raw = extractLayoutSpec(call.result)

            if (raw === null) {
                return this.fallback(
                    context,
                    market,
                    'the model replied but no layout spec could be parsed out of it',
                    call.result,
                )
            }

            const { spec, notes } = validateLayout(raw, market)
            return {
                spec,
                notes,
                provenance: SpecProvenanceSchema.parse({
                    generated_at: new Date().toISOString(),
                    source: 'live',
                    model: call.model,
                    prompt_version: call.promptVersion,
                    context_id: contextId,
                    raw_response: call.result,
                    cost_usd: call.costUsd,
                    duration_ms: call.durationMs,
                    input_tokens: call.inputTokens,
                }),
            }
        } catch (error) {
            return this.fallback(
                context,
                market,
                error instanceof Error ? error.message : 'unknown error',
                null,
            )
        }
    }

    /**
     * Live call failed — serve this context's precomputed spec and be explicit
     * about it. Reuses `PrecomputedProvider` rather than reaching into the spec
     * library, so there is one path to a precomputed layout.
     */
    private async fallback(
        context: Context,
        market: Market,
        reason: string,
        rawResponse: string | null,
    ): Promise<ResolvedLayout> {
        const precomputed = await new PrecomputedProvider().getLayout(context, market)

        return {
            ...precomputed,
            provenance: { ...precomputed.provenance, raw_response: rawResponse },
            notes: [
                { level: 'fallback', reason: `live orchestration failed: ${reason}` },
                ...precomputed.notes,
            ],
        }
    }
}
