import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'

import { buildMessage, extractLayoutSpec } from './live'

/**
 * No test here makes a real model call — each one costs money and would make the
 * suite non-deterministic. What is worth testing is everything around the call:
 * the parsing, which has to survive whatever shape the model replies in, and the
 * message, which has to never offer a module the renderer cannot draw.
 */

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(leahBudget80)

const SPEC = {
    layout: [{ module: 'production_list', size: 'standard', props: { sort: 'date' } }],
    reasoning: 'because',
}

describe('extractLayoutSpec', () => {
    it('parses a bare JSON object', () => {
        expect(extractLayoutSpec(JSON.stringify(SPEC))).toEqual(SPEC)
    })

    it('tolerates surrounding whitespace', () => {
        expect(extractLayoutSpec(`\n\n  ${JSON.stringify(SPEC)}\n `)).toEqual(SPEC)
    })

    it('digs the object out of a fenced code block', () => {
        const reply = `Here you go:\n\n\`\`\`json\n${JSON.stringify(SPEC, null, 2)}\n\`\`\`\n`
        expect(extractLayoutSpec(reply)).toEqual(SPEC)
    })

    it('digs the object out of surrounding prose', () => {
        const reply = `I considered the budget. ${JSON.stringify(SPEC)} Let me know if you want changes.`
        expect(extractLayoutSpec(reply)).toEqual(SPEC)
    })

    it('handles nested braces rather than stopping at the first closing one', () => {
        // The naive "up to the first }" approach truncates every real spec,
        // since props are themselves objects.
        const nested = {
            layout: [
                {
                    module: 'production_list',
                    props: { filter: { max_price: 80 }, sort: 'price' },
                },
            ],
            reasoning: 'nested',
        }
        expect(extractLayoutSpec(`text ${JSON.stringify(nested)} more`)).toEqual(nested)
    })

    it('is not fooled by braces inside strings', () => {
        const withBraces = { ...SPEC, reasoning: 'a } brace and a { brace in prose' }
        expect(extractLayoutSpec(`\n${JSON.stringify(withBraces)}\n`)).toEqual(withBraces)
    })

    it('returns null for prose with no object', () => {
        expect(extractLayoutSpec('I am not going to do that.')).toBeNull()
    })

    it('returns null for an unterminated object', () => {
        expect(extractLayoutSpec('{"layout": [{"module": "production_list"')).toBeNull()
    })

    it('returns null for valid JSON that is not an object', () => {
        // A bare string or number parses but is not a spec — treating it as one
        // would push a nonsense value into the validator.
        expect(extractLayoutSpec('"just a string"')).toBeNull()
        expect(extractLayoutSpec('42')).toBeNull()
    })

    it('returns null for empty input', () => {
        expect(extractLayoutSpec('')).toBeNull()
    })
})

describe('buildMessage', () => {
    const message = buildMessage(context, market)

    it('includes the context and the market snapshot', () => {
        expect(message).toContain('"persona_id": "leah_onsale"')
        expect(message).toContain('"stated_budget": 80')
        expect(message).toContain('Gainbridge Fieldhouse')
    })

    it('offers only modules that are implemented and orchestrated', () => {
        expect(message).toContain('`production_list`')
        expect(message).toContain('`market_signals`')
        // Specified but not implemented — offering it would produce a spec the
        // validator has to drop, wasting the call. `listing_preview` is the only
        // entry left in that state, so it is the whole guard.
        expect(message).not.toContain('`listing_preview`')
    })

    it('tells the model which column each module renders in', () => {
        // A fact, not a knob: region is intrinsic to the module, so the model
        // needs to know a rail card is desktop-only supporting context, but has
        // nothing to decide about it.
        expect(message).toContain('region: main column')
        expect(message).toContain('region: right rail (desktop only)')
    })

    it('does not offer page chrome as placeable', () => {
        expect(message).not.toContain('`event_header` (')
        expect(message).toContain('never yours to place')
    })

    it('states the sizes each module offers', () => {
        expect(message).toMatch(/sizes: hero \| standard \| compact/)
    })
})
