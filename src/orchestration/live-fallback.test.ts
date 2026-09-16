import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'
import type { BridgeResult } from './bridge'

/**
 * The bridge spawns a CLI and costs real money per call, so it is mocked. What
 * these tests cover is what the provider does with what comes back — above all
 * when what comes back is unusable, since the demo depends on a failed call
 * still producing a sensible page that does not claim to be live.
 *
 * The mock's behaviour is driven by a `vi.hoisted` box rather than per-test
 * `mockRejectedValue` / `mockImplementation`. A rejection created inside a test
 * body gets reported by vitest as a test failure even when the code under test
 * caught it and every assertion passes; a throw from inside the factory
 * implementation does not. The box keeps per-test control without that.
 */
const bridge = vi.hoisted(() => ({
    mode: 'ok' as 'ok' | 'throw',
    reply: null as unknown,
}))

// The cache is real code that writes to disk. Left unmocked, one test's
// composition gets served to the next and the mock is never consulted.
vi.mock('./cache', () => ({
    cacheKey: () => 'test-key',
    readCached: vi.fn(async () => null),
    writeCached: vi.fn(async () => undefined),
}))

// The ledger appends to `.cache/calls.log`, which is a record of real money
// spent on this machine. A test run must never write to it.
vi.mock('./ledger', () => ({
    recordCall: vi.fn(async () => undefined),
}))

vi.mock('./bridge', () => ({
    callModel: vi.fn(async () => {
        if (bridge.mode === 'throw') throw new Error('could not run `claude`')
        return bridge.reply
    }),
    readPromptVersion: vi.fn(async () => 'v-test'),
    readPromptText: vi.fn(async () => '# Orchestrator prompt — v-test'),
}))

import { LiveProvider, readComposition } from './live'
import { readCached } from './cache'
import { callModel } from './bridge'
import { recordCall } from './ledger'

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(leahBudget80)

function reply(result: string): BridgeResult {
    return {
        result,
        model: 'claude-opus-5',
        promptVersion: 'v4',
        costUsd: 0.5,
        durationMs: 1234,
        inputTokens: 13000,
    }
}

const GOOD = JSON.stringify({
    layout: [{ module: 'production_list', size: 'hero', props: { sort: 'price' } }],
    reasoning: 'a real reason from the model',
})

beforeEach(() => {
    bridge.mode = 'ok'
    bridge.reply = reply(GOOD)
})

describe('LiveProvider', () => {
    it('marks a successful composition as live, with cost and latency', async () => {
        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.provenance.source).toBe('live')
        expect(resolved.provenance.model).toBe('claude-opus-5')
        expect(resolved.provenance.prompt_version).toBe('v4')
        expect(resolved.provenance.cost_usd).toBe(0.5)
        expect(resolved.provenance.duration_ms).toBe(1234)
        expect(resolved.spec.layout[0].module).toBe('production_list')
        expect(resolved.spec.reasoning).toContain('a real reason')
    })

    it('keeps the unparsed reply so the drawer can show what the model said', async () => {
        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.provenance.raw_response).toBe(GOOD)
    })

    it('still validates live output — a hallucinated module is dropped', async () => {
        bridge.reply = reply(
            JSON.stringify({
                layout: [
                    { module: 'vibe_check', props: {} },
                    { module: 'production_list', props: {} },
                ],
                reasoning: 'r',
            }),
        )

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(resolved.notes.some((note) => note.level === 'dropped')).toBe(true)
    })

    it('falls back to the static layout when the call fails', async () => {
        bridge.mode = 'throw'

        const resolved = await new LiveProvider().getLayout(context, market)

        // Never claims `live` for something the model did not produce. It used
        // to serve a hand-authored composition here; the static layout is the
        // more honest failure, because a page composed for somebody else and
        // presented without comment is a worse lie than a page that plainly did
        // not compose.
        expect(resolved.provenance.source).toBe('fallback')
        expect(resolved.provenance.model).toBeNull()
        expect(resolved.spec.layout.length).toBeGreaterThan(0)
        expect(resolved.notes[0].level).toBe('fallback')
        expect(resolved.notes[0].reason).toContain('live orchestration failed')
        expect(resolved.notes[0].reason).toContain('could not run')
    })

    it('falls back when the model replies with prose instead of a spec', async () => {
        bridge.reply = reply("I'd rather not.")

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.provenance.source).toBe('fallback')
        expect(resolved.notes[0].reason).toContain('no layout spec could be parsed')
        // The unusable reply is still shown, so the failure is diagnosable.
        expect(resolved.provenance.raw_response).toBe("I'd rather not.")
    })

    it('falls back rather than rendering an empty page when nothing survives', async () => {
        bridge.reply = reply(
            JSON.stringify({ layout: [{ module: 'nope', props: {} }], reasoning: 'r' }),
        )

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.spec.layout.length).toBeGreaterThan(0)
    })
})

describe('LiveProvider — replaying a cached composition', () => {
    it('re-validates on the way out, so a rule added in code repairs what was already paid for', async () => {
        // The composition as it was stored: a named section that also asked for
        // geo grouping, which prints its heading above every group. The repair
        // for that landed after this spec was cached, and re-running the call to
        // pick it up would cost real money.
        vi.mocked(readCached).mockResolvedValueOnce({
            spec: {
                layout: [
                    {
                        module: 'production_list',
                        size: 'hero',
                        props: { heading: 'Packed nights, under $80', group_by_geo: true },
                    },
                ],
                reasoning: 'stored earlier',
            },
            notes: [],
            provenance: {
                generated_at: '2026-09-10T19:11:11.672Z',
                source: 'live',
                model: 'claude-sonnet-5',
                prompt_version: 'v4',
                context_id: 'eval',
                cost_usd: 0.15,
                duration_ms: 159555,
                input_tokens: 16506,
            },
        } as never)

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.spec.layout[0].props.group_by_geo).toBe(false)
        // The replay note still comes first, and the cost is still the original
        // call's — a repaired replay must not read as a free fresh composition.
        expect(resolved.notes[0].reason).toContain('replayed from cache')
        expect(resolved.notes.some((note) => note.reason.includes('group_by_geo'))).toBe(true)
        expect(resolved.provenance.cost_usd).toBe(0.15)
    })
})

/**
 * The page's own path into a composition.
 *
 * The one property that matters here is negative: `readComposition` must never
 * reach the bridge. Rendering the page used to be able to call the model, and a
 * GET is replayable — hot reload, a refresh, a second tab, a prefetch — so calls
 * happened that nobody asked for, three of which died at the timeout and billed
 * for nothing. Calling now requires a POST to `/api/compose`.
 */
describe('readComposition — what the page is allowed to do', () => {
    // Call counts are the assertion here, so they start from zero. Earlier
    // tests in this file drive the bridge on purpose.
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null on a cache miss without calling the model', async () => {
        vi.mocked(readCached).mockResolvedValueOnce(null)

        expect(await readComposition(context, market, 'eval')).toBeNull()
        expect(callModel).not.toHaveBeenCalled()
    })

    it('replays a cached composition without calling the model', async () => {
        vi.mocked(readCached).mockResolvedValueOnce({
            spec: {
                layout: [{ module: 'production_list', size: 'hero', props: { sort: 'price' } }],
                reasoning: 'composed earlier',
                top_pick: null,
                visitor_metro: null,
                top_pick_reason: null,
            },
            notes: [],
            provenance: {
                generated_at: '2026-09-11T00:00:00.000Z',
                source: 'live',
                model: 'claude-sonnet-5',
                prompt_version: 'v8',
                context_id: 'eval/x',
                raw_response: null,
                cost_usd: 0.14,
                duration_ms: 76_000,
                input_tokens: 18_207,
            },
        })

        const resolved = await readComposition(context, market, 'eval')

        expect(callModel).not.toHaveBeenCalled()
        expect(resolved?.provenance.source).toBe('live')
        // The cost of the original call is preserved, so a replay never reads
        // as free in the panel.
        expect(resolved?.provenance.cost_usd).toBe(0.14)
        expect(resolved?.notes[0]?.reason).toContain('replayed from cache')
    })

    it('records a successful call in the ledger with what it cost', async () => {
        vi.mocked(readCached).mockResolvedValueOnce(null)

        await new LiveProvider({ mode: 'eval', trigger: 'run button' }).getLayout(context, market)

        expect(recordCall).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'eval',
                trigger: 'run button',
                outcome: 'composed',
                costUsd: 0.5,
            }),
        )
    })

    it('records a failed call too — a timeout buys nothing and must still show up', async () => {
        vi.mocked(readCached).mockResolvedValueOnce(null)
        bridge.mode = 'throw'

        await new LiveProvider({ mode: 'eval', trigger: 'run button' }).getLayout(context, market)

        expect(recordCall).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'failed', costUsd: null }),
        )
    })
})
