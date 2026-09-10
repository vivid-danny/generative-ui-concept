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

vi.mock('./bridge', () => ({
    callModel: vi.fn(async () => {
        if (bridge.mode === 'throw') throw new Error('could not run `claude`')
        return bridge.reply
    }),
    readPromptVersion: vi.fn(async () => 'v-test'),
    readPromptText: vi.fn(async () => '# Orchestrator prompt — v-test'),
}))

import { LiveProvider } from './live'

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(leahBudget80)

function reply(result: string): BridgeResult {
    return {
        result,
        model: 'claude-opus-5',
        promptVersion: 'v3',
        costUsd: 0.5,
        durationMs: 1234,
        inputTokens: 13000,
    }
}

const GOOD = JSON.stringify({
    layout: [{ module: 'production_list', size: 'hero', props: { sort: 'price' } }],
    reasoning: 'a real reason from the model',
    headline: 'a headline',
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
        expect(resolved.provenance.prompt_version).toBe('v3')
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
                layout: [{ module: 'vibe_check', props: {} }, { module: 'production_list', props: {} }],
                reasoning: 'r',
                headline: null,
            }),
        )

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(resolved.notes.some((note) => note.level === 'dropped')).toBe(true)
    })

    it('falls back to the precomputed spec when the call fails', async () => {
        bridge.mode = 'throw'

        const resolved = await new LiveProvider().getLayout(context, market)

        // Never claims `live` for something the model did not produce.
        expect(resolved.provenance.source).toBe('precomputed')
        expect(resolved.spec.layout.length).toBeGreaterThan(0)
        expect(resolved.notes[0].level).toBe('fallback')
        expect(resolved.notes[0].reason).toContain('live orchestration failed')
        expect(resolved.notes[0].reason).toContain('could not run')
    })

    it('falls back when the model replies with prose instead of a spec', async () => {
        bridge.reply = reply("I'd rather not.")

        const resolved = await new LiveProvider().getLayout(context, market)

        expect(resolved.provenance.source).toBe('precomputed')
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
