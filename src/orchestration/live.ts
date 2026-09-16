import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import { SpecProvenanceSchema, type ResolvedLayout } from '@/contracts/layout-spec'
import { MODULE_CATALOG, type ModuleId } from '@/contracts/module-catalog'

import { callModel, readPromptText } from './bridge'
import { cacheKey, readCached, writeCached } from './cache'
import { recordCall } from './ledger'
import { specKeyFor } from './context-key'
import type { OrchestrationProvider } from './provider'
import { FALLBACK_LAYOUT, validateLayout } from './validate'

/**
 * Live orchestration — the composition happens at request time.
 *
 * This is the whole point of the `OrchestrationProvider` seam: the renderer, the
 * validator, the contracts and the modules are all unchanged, and the only
 * difference from the static baseline is where the layout spec comes from.
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
                // A fact, not a knob. Where a module renders is intrinsic to it
                // (docs/COMPOSABILITY.md), but the model should know a rail card
                // is narrow, desktop-only context before it leans on one.
                `  region: ${
                    module.region === 'rail' ? 'right rail (desktop only)' : 'main column'
                }`,
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
    // Ordered stable-first, volatile-last, because prompt caching matches on a
    // prefix: anything that changes between calls invalidates everything after
    // it. The market snapshot is by far the largest part of this message and the
    // least likely to change, so it leads; the brief varies every time and goes
    // last. Putting the brief first — as this did — meant a new brief paid to
    // re-send 9,000 tokens of inventory that had not moved.
    const sections = [
        `Compose the page for this visitor. The inventory comes first, then what you
may place, then who is landing.`,
        // Minified rather than pretty-printed: indentation cost ~3,000 tokens a
        // call and the model reads it identically.
        `## Market snapshot (the inventory that exists)

\`\`\`json
${JSON.stringify(market)}
\`\`\``,
        `## Modules you may place

${catalogForPrompt()}

Other modules exist in the catalog but are not implemented yet — do not place
them. \`event_header\` is page chrome and is never yours to place.`,
        `## Context (who is landing)

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\``,
    ]

    // The brief is the operator's own account of the visitor and carries intent
    // the structured fields cannot. Last, both because it is the most volatile
    // part and because it should be the freshest thing in mind.
    if (context.brief) {
        sections.push(
            `## Who is landing, described by the person running this

> ${context.brief}

Treat this as the primary account of the visitor. The structured context above
may be sparse or partly stale; where the two disagree, the description wins. Do
not invent structured values to fill gaps — compose for what you actually know.`,
        )
    }

    sections.push(`Reply with the layout spec object and nothing else — no prose, no code fence.`)

    return sections.join('\n\n')
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

export interface LiveProviderOptions {
    /** Names the cache bucket, and shows up in the panel. */
    mode?: string
    /** Skip the cache and pay for a new composition. The re-run button. */
    fresh?: boolean
    /** What asked for this call, for the ledger. */
    trigger?: string
}

/**
 * The cache key for a composition, given what would be sent.
 *
 * Exported because two callers need the same key from different sides: the page
 * reads it, and `/api/compose` writes it. Deriving it twice from the same inputs
 * is what makes "press Run, then the page finds it" work without passing
 * anything between them.
 */
export async function compositionKey(
    context: Context,
    market: Market,
    mode: string,
): Promise<string> {
    return cacheKey({
        mode,
        message: buildMessage(context, market),
        promptText: await readPromptText(),
    })
}

/**
 * A composition already paid for, or null.
 *
 * **This is the only path the page itself uses.** Rendering a page can no longer
 * spend money: a GET is replayable by design — hot reload, a refresh, a second
 * tab, a link prefetch, a curl — and every unintended call so far came from one
 * of those re-running `getServerSideProps`. Calling now requires a POST to
 * `/api/compose`, which nothing replays on its own.
 */
export async function readComposition(
    context: Context,
    market: Market,
    mode: string,
): Promise<ResolvedLayout | null> {
    const cached = await readCached(await compositionKey(context, market, mode))
    if (!cached) return null
    return replay(cached, market)
}

/**
 * Re-validate a stored composition on the way out, and mark it as a replay.
 *
 * Not trusted as stored: a rule added in code should repair the compositions
 * already paid for rather than waiting for the next call. Idempotent on a spec
 * that already passed, so a replay with no rule changes reports nothing new.
 */
function replay(cached: ResolvedLayout, market: Market): ResolvedLayout {
    const revalidated = validateLayout(cached.spec, market)

    return {
        ...cached,
        spec: revalidated.spec,
        // The original provenance is kept as-is — including what the call cost —
        // so the panel never implies this was free. The note is what tells you
        // it is a replay.
        notes: [
            {
                level: 'repaired',
                reason: `replayed from cache (composed ${cached.provenance.generated_at}); press Run for a fresh composition`,
            },
            ...cached.notes,
            ...revalidated.notes,
        ],
    }
}

export class LiveProvider implements OrchestrationProvider {
    readonly name = 'Live (composed at request time by Claude)'
    readonly isLive = true

    constructor(private readonly options: LiveProviderOptions = {}) {}

    async getLayout(context: Context, market: Market): Promise<ResolvedLayout> {
        const contextId = specKeyFor(context)
        const mode = this.options.mode ?? 'live'

        // Keyed on the exact message plus the prompt text, so editing the
        // prompt, the catalog, a propsHint or the fixture all invalidate — a
        // composition attributed to instructions that no longer exist would be
        // worse than no cache.
        const message = buildMessage(context, market)
        const key = await compositionKey(context, market, mode)

        if (!this.options.fresh) {
            const cached = await readCached(key)
            if (cached) return replay(cached, market)
        }

        const startedAt = Date.now()
        const logFailure = (outcome: 'unparseable' | 'failed', error: string) =>
            recordCall({
                at: new Date().toISOString(),
                mode,
                key,
                // Load-bearing on the failure path, not bookkeeping. A typed
                // brief lives in the drawer's React state until a call
                // succeeds, so when one times out at 180s this line is the only
                // surviving copy of what was asked for — and a timeout is the
                // most expensive outcome, since it buys nothing.
                brief: context.brief ?? null,
                trigger: this.options.trigger ?? 'unknown',
                outcome,
                durationMs: Date.now() - startedAt,
                // A failed call still spent tokens; we just never learn how many,
                // because the cost arrives in the envelope we did not get.
                costUsd: null,
                inputTokens: null,
                error,
            })

        try {
            const call = await callModel(message)
            const raw = extractLayoutSpec(call.result)

            if (raw === null) {
                await logFailure('unparseable', 'no layout spec could be parsed out of the reply')
                return this.fallback(
                    context,
                    market,
                    'the model replied but no layout spec could be parsed out of it',
                    call.result,
                )
            }

            const { spec, notes } = validateLayout(raw, market)
            const resolved: ResolvedLayout = {
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

            await writeCached(key, resolved)
            await recordCall({
                at: resolved.provenance.generated_at,
                mode,
                key,
                brief: context.brief ?? null,
                trigger: this.options.trigger ?? 'unknown',
                outcome: 'composed',
                durationMs: call.durationMs,
                costUsd: call.costUsd,
                inputTokens: call.inputTokens,
            })
            return resolved
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'unknown error'
            await logFailure('failed', reason)
            return this.fallback(context, market, reason, null)
        }
    }

    /**
     * Live call failed — serve the static layout and say so.
     *
     * This used to serve a hand-authored composition for the nearest matching
     * context. That library is gone, and the static layout is the more honest
     * failure anyway: a page composed for somebody else, presented without
     * comment as though it were composed for this visitor, is a worse lie than a
     * page that plainly did not compose. The note and the provenance both say
     * `fallback`.
     */
    private async fallback(
        _context: Context,
        _market: Market,
        reason: string,
        rawResponse: string | null,
    ): Promise<ResolvedLayout> {
        return {
            spec: FALLBACK_LAYOUT,
            provenance: SpecProvenanceSchema.parse({
                generated_at: new Date().toISOString(),
                source: 'fallback',
                model: null,
                prompt_version: null,
                context_id: specKeyFor(_context),
                raw_response: rawResponse,
            }),
            notes: [{ level: 'fallback', reason: `live orchestration failed: ${reason}` }],
        }
    }
}
