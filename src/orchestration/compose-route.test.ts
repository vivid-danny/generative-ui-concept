import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../pages/api/compose'

/**
 * The money-guarding branch, which shipped with no test at all.
 *
 * This route is the only thing in the app that can spend money — ~$0.15 and up
 * to 180 seconds a call — so the question these tests answer is not "does it
 * compose" but "can two calls ever be in flight at once". They have been, twice,
 * for different reasons:
 *
 * - The lock was keyed by composition, and a typed brief is a new key every
 *   time, so two briefs were two concurrent calls by design.
 * - `fresh` skipped the join, so two presses of Re-run on the *same* brief both
 *   called — same composition, two bills.
 *
 * `LiveProvider` is mocked with a promise the test resolves by hand, because
 * every interesting case is about what happens while a call is still running.
 *
 * Lives here rather than beside the route: anything under `pages/api/` is an
 * API route to Next, and a test file has no default export, so `next build`
 * fails on it.
 */

const getLayout = vi.fn()

vi.mock('@/orchestration/live', () => ({
    // A stable key per brief, without hashing the real message. The route only
    // needs it to distinguish compositions, and the real derivation reads
    // `orchestrator/prompt.md` off disk.
    compositionKey: vi.fn(async (context: { brief?: string | null }) => `key:${context.brief}`),
    LiveProvider: class {
        getLayout(...args: unknown[]) {
            return getLayout(...args)
        }
    },
}))

/** A call the test decides when to finish. */
function pending() {
    let settle: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
        settle = resolve
    })

    return {
        settle,
        layout: gate.then(() => ({
            spec: { layout: [], reasoning: 'composed', headline: null, top_pick: null },
            notes: [],
            provenance: { source: 'live', cost_usd: 0.15, duration_ms: 60_000 },
        })),
    }
}

interface Captured {
    status: number | null
    body: Record<string, unknown> | null
}

function post(body: unknown): { sent: Promise<void>; captured: Captured } {
    const captured: Captured = { status: null, body: null }

    const res = {
        status(code: number) {
            captured.status = code
            return this
        },
        json(payload: Record<string, unknown>) {
            captured.body = payload
            return this
        },
    } as unknown as NextApiResponse

    return {
        sent: handler({ method: 'POST', body } as unknown as NextApiRequest, res),
        captured,
    }
}

/** Lets the microtask queue drain so an in-flight request reaches its await. */
const settled = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
    getLayout.mockReset()
})

describe('POST /api/compose — the one-call lock', () => {
    it('refuses a second call for a different brief while one is running', async () => {
        const first = pending()
        getLayout.mockReturnValueOnce(first.layout)

        const running = post({ mode: 'custom', brief: 'brief one' })
        await settled()

        const collided = post({ mode: 'custom', brief: 'brief two' })
        await collided.sent

        expect(collided.captured.status).toBe(409)
        // Two briefs used to be two keys, and two keys were two calls.
        expect(getLayout).toHaveBeenCalledTimes(1)

        first.settle()
        await running.sent
    })

    it('refuses a second re-run of the same brief rather than paying twice', async () => {
        // The hole the per-key map left: `fresh` skipped the join, so both
        // presses fell through to a call. Same composition, ~$0.30.
        const first = pending()
        getLayout.mockReturnValueOnce(first.layout)

        const running = post({ mode: 'custom', brief: 'the same brief', fresh: true })
        await settled()

        const collided = post({ mode: 'custom', brief: 'the same brief', fresh: true })
        await collided.sent

        expect(collided.captured.status).toBe(409)
        expect(getLayout).toHaveBeenCalledTimes(1)

        first.settle()
        await running.sent
    })

    it('names what is already running, so a 409 says where to look', async () => {
        const first = pending()
        getLayout.mockReturnValueOnce(first.layout)

        const running = post({ mode: 'custom', brief: 'a Chicago visitor with $80' })
        await settled()

        const collided = post({ mode: 'eval', brief: null })
        await collided.sent

        expect(collided.captured.body?.reason).toContain('a Chicago visitor with $80')
        // A 409 spent nothing, and the drawer's hint depends on knowing that.
        expect(collided.captured.body?.reason).toContain('nothing was spent')

        first.settle()
        await running.sent
    })

    it('joins a second press for the same composition instead of refusing it', async () => {
        const first = pending()
        getLayout.mockReturnValueOnce(first.layout)

        const running = post({ mode: 'custom', brief: 'shared' })
        await settled()

        const joined = post({ mode: 'custom', brief: 'shared' })
        first.settle()

        await Promise.all([running.sent, joined.sent])

        expect(joined.captured.status).toBe(200)
        expect(joined.captured.body?.reason).toBe('joined a call already in flight')
        expect(getLayout).toHaveBeenCalledTimes(1)
    })

    it('releases the lock once the call finishes', async () => {
        const first = pending()
        getLayout.mockReturnValueOnce(first.layout)
        const running = post({ mode: 'custom', brief: 'first' })
        await settled()
        first.settle()
        await running.sent

        const second = pending()
        getLayout.mockReturnValueOnce(second.layout)
        const next = post({ mode: 'custom', brief: 'second' })
        await settled()
        second.settle()
        await next.sent

        expect(next.captured.status).toBe(200)
        expect(getLayout).toHaveBeenCalledTimes(2)
    })

    it('does not let a finished request release a lock it no longer holds', async () => {
        // Deleting unconditionally meant the request that finished first cleared
        // the slot while another call was still running, and the next press
        // sailed through into a second concurrent call.
        const joinable = pending()
        getLayout.mockReturnValueOnce(joinable.layout)

        const running = post({ mode: 'custom', brief: 'held' })
        await settled()
        const joined = post({ mode: 'custom', brief: 'held' })
        await settled()

        // The joined request returns without touching the slot.
        const third = post({ mode: 'custom', brief: 'someone else' })
        await third.sent

        expect(third.captured.status).toBe(409)
        expect(getLayout).toHaveBeenCalledTimes(1)

        joinable.settle()
        await Promise.all([running.sent, joined.sent])
    })
})

describe('POST /api/compose — what it refuses outright', () => {
    it('rejects a GET, because a URL that spends money is the defect', async () => {
        const captured: Captured = { status: null, body: null }
        const res = {
            status(code: number) {
                captured.status = code
                return this
            },
            json(payload: Record<string, unknown>) {
                captured.body = payload
                return this
            },
        } as unknown as NextApiResponse

        await handler({ method: 'GET' } as unknown as NextApiRequest, res)

        expect(captured.status).toBe(405)
        expect(getLayout).not.toHaveBeenCalled()
    })

    it('rejects base, which composes nothing', async () => {
        const { sent, captured } = post({ mode: 'base' })
        await sent

        expect(captured.status).toBe(400)
        expect(getLayout).not.toHaveBeenCalled()
    })

    it('rejects custom with nothing typed', async () => {
        const { sent, captured } = post({ mode: 'custom', brief: '   ' })
        await sent

        expect(captured.status).toBe(400)
        expect(getLayout).not.toHaveBeenCalled()
    })
})
