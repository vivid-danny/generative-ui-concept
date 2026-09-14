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
 * - **One call per key at a time.** `readCached` runs before a call and
 *   `writeCached` after it, so two requests inside the same ~100-second window
 *   used to both pay. In-flight requests now share one promise.
 * - **Every attempt is recorded**, by `LiveProvider` into `.cache/calls.log`,
 *   including failures. A timeout leaves no composition to inspect, which made
 *   it the easiest kind of spending to miss entirely.
 */

/**
 * Requests currently in flight, by cache key.
 *
 * Module-level, so it is per dev-server process — which is exactly the scope
 * that matters, since that process is the one making the calls. It is not
 * durable across a restart and does not need to be: a restart cannot have a
 * call in flight.
 */
const inFlight = new Map<string, Promise<ComposeResult>>()

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

    // A second press while the first is still running joins it rather than
    // starting another. The button is disabled during a call, so this is the
    // backstop for a second tab or a stray retry.
    const running = inFlight.get(key)
    if (running && !fresh) {
        res.status(200).json({ ...(await running), status: 'cached', reason: 'joined a call already in flight' })
        return
    }

    const work = compose(mode, fresh)
    inFlight.set(key, work)

    try {
        const result = await work
        res.status(result.status === 'failed' ? 502 : 200).json(result)
    } finally {
        inFlight.delete(key)
    }
}

async function compose(
    mode: ReturnType<typeof modeFor>,
    fresh: boolean,
): Promise<ComposeResult> {
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
