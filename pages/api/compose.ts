import type { NextApiRequest, NextApiResponse } from 'next'

import { MARKET, isModeSlug, modeFor } from '@/demo/modes'
import { compositionKey } from '@/orchestration/live'
import { LiveProvider } from '@/orchestration/live'

/**
 * The only path in the app that can spend money.
 *
 * Composition used to happen inside `getServerSideProps`, which meant *rendering
 * the page* could call the model. A GET is replayable by design — Next's dev
 * server re-fetches props on hot reload and double-invokes on a cold compile, a
 * refresh repeats it, a second tab repeats it, a link prefetch repeats it — so
 * calls kept happening that nobody asked for. Five went through in one morning
 * from two deliberate clicks, and three of those died at the timeout, billing
 * for nothing.
 *
 * A POST fixes that at the root: nothing in the stack replays one on its own, so
 * a call now requires a person pressing a button. The page itself reads cache
 * only (`readComposition`) and can no longer call at all.
 *
 * Two further guarantees:
 *
 * - **One call at a time, full stop.** `readCached` runs before a call and
 *   `writeCached` after it, so two requests inside the same ~100-second window
 *   used to both pay. Two presses on the same composition now share one
 *   promise; anything else that arrives mid-call gets a 409 rather than a
 *   queue, because a queued call spends money after you have stopped looking.
 * - **Every attempt is recorded**, by `LiveProvider` into `.cache/calls.log`,
 *   including failures. A timeout leaves no composition to inspect, which made
 *   it the easiest kind of spending to miss entirely.
 */

/**
 * The one call allowed to be in flight, or null.
 *
 * A single slot, not a map keyed by composition. The map was written when the
 * only brief was a scripted fixture, so two concurrent calls meant two presses
 * on the same key and joining them was the whole job. A typed brief is a new
 * key every time, so "one per key" stopped being a limit at all — two tabs on
 * two briefs were two calls, ~$0.30, by design.
 *
 * Module-level, so it is per dev-server process — which is exactly the scope
 * that matters, since that process is the one making the calls. It is not
 * durable across a restart and does not need to be: a restart cannot have a
 * call in flight.
 */
let current: { key: string; promise: Promise<ComposeResult>; label: string } | null = null

interface ComposeResult {
    status: 'composed' | 'cached' | 'failed'
    costUsd: number | null
    durationMs: number | null
    /** Present when the composition did not come from the model. */
    reason?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        // Deliberately not a GET, and saying so: a URL that spends money is the
        // defect this route exists to remove.
        res.status(405).json({ error: 'POST only — a GET that spends money is the bug' })
        return
    }

    const body = (req.body ?? {}) as { mode?: unknown; brief?: unknown; fresh?: unknown }
    const slug = typeof body.mode === 'string' && isModeSlug(body.mode) ? body.mode : null
    const brief = typeof body.brief === 'string' ? body.brief : null

    if (slug === null || slug === 'base') {
        res.status(400).json({ error: 'mode must be "eval" or "custom"' })
        return
    }

    const mode = modeFor(slug, brief)
    if (mode.brief === null) {
        res.status(400).json({ error: 'nothing to compose from — this mode has no brief' })
        return
    }

    const key = await compositionKey(mode.context, MARKET, mode.slug)
    const fresh = body.fresh === true

    // A second press for the same composition joins the call already running
    // rather than starting another. The button is disabled during a call, so
    // this is the backstop for a second tab or a stray retry.
    //
    // `fresh` is excluded on purpose: a re-run is a request for a *new*
    // composition, so joining would answer it with the one already being paid
    // for. Two tabs both pressing Re-run used to satisfy neither branch and
    // both call — same key, same brief, two bills, one composition.
    if (current !== null && current.key === key && !fresh) {
        res.status(200).json({
            ...(await current.promise),
            status: 'cached',
            reason: 'joined a call already in flight',
        })
        return
    }

    // Anything else in flight is refused rather than queued. Queuing hides
    // spending behind a wait: you press, nothing appears to happen, and a
    // second call you have forgotten about bills a minute later.
    if (current !== null) {
        res.status(409).json({
            error: 'a composition is already running',
            // Names the call it collided with. A 409 only ever arrives from
            // another tab — the button disables itself in-tab for the duration
            // — so "rejected" with no subject leaves nowhere to look.
            reason: `${current.label} is already composing. One call at a time — nothing was spent on this press. Wait for it to finish, then press again.`,
        })
        return
    }

    const work = compose(mode, fresh)
    current = { key, promise: work, label: describe(mode) }

    try {
        const result = await work
        res.status(result.status === 'failed' ? 502 : 200).json(result)
    } finally {
        // Only if it is still ours. Clearing unconditionally let a request that
        // finished early release a lock it did not hold, and the next press
        // sailed straight through into a second concurrent call.
        if (current?.promise === work) current = null
    }
}

/** What is running, for the message a collided press gets back. */
function describe(mode: ReturnType<typeof modeFor>): string {
    if (mode.slug === 'eval') return 'The eval brief'
    const brief = mode.brief ?? ''
    return brief.length > 60 ? `"${brief.slice(0, 60)}…"` : `"${brief}"`
}

async function compose(mode: ReturnType<typeof modeFor>, fresh: boolean): Promise<ComposeResult> {
    const provider = new LiveProvider({ mode: mode.slug, fresh, trigger: 'run button' })
    const resolved = await provider.getLayout(mode.context, MARKET)

    if (resolved.provenance.source === 'fallback') {
        return {
            status: 'failed',
            costUsd: null,
            durationMs: null,
            reason:
                resolved.notes.find((note) => note.level === 'fallback')?.reason ??
                'the call did not produce a composition',
        }
    }

    return {
        status: 'composed',
        costUsd: resolved.provenance.cost_usd ?? null,
        durationMs: resolved.provenance.duration_ms ?? null,
    }
}
