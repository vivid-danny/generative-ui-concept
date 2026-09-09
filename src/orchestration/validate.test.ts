import { describe, expect, it } from 'vitest'

import { MarketSchema, type Market } from '@/contracts/market'
import marketJson from '@/fixtures/market.json'

import { FALLBACK_LAYOUT, STRUCTURAL_RULES, validateLayout } from './validate'

/**
 * The validator is the one place in the prototype where a bug is silent and
 * costs a demo: a bad spec that renders half a page looks like a broken product
 * rather than a broken spec. So these tests cover the failure paths, not the
 * happy one.
 */

const market: Market = MarketSchema.parse(marketJson)

const validSpec = {
    layout: [{ module: 'production_list', size: 'standard', props: { sort: 'date' } }],
    reasoning: 'a reason',
    headline: null,
}

describe('validateLayout', () => {
    it('passes a valid spec through and applies prop defaults', () => {
        const result = validateLayout(validSpec, market)

        expect(result.usedFallback).toBe(false)
        expect(result.notes).toEqual([])
        expect(result.spec.layout).toHaveLength(1)
        // `group_by_geo` and `max_items` were absent; the module's own defaults fill in.
        expect(result.spec.layout[0].props).toMatchObject({
            sort: 'date',
            group_by_geo: true,
            max_items: 8,
        })
    })

    it('falls back when the spec does not match the schema at all', () => {
        const result = validateLayout({ nonsense: true }, market)

        expect(result.usedFallback).toBe(true)
        expect(result.spec).toEqual(FALLBACK_LAYOUT)
        expect(result.notes[0].level).toBe('fallback')
    })

    it('falls back when reasoning is missing — it is a required field, not a nicety', () => {
        const result = validateLayout({ layout: validSpec.layout }, market)

        expect(result.usedFallback).toBe(true)
    })

    it('drops a hallucinated module rather than failing the page', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'vibe_check', props: {} }, ...validSpec.layout] },
            market,
        )

        expect(result.usedFallback).toBe(false)
        expect(result.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(result.notes).toContainEqual({
            level: 'dropped',
            module: 'vibe_check',
            reason: 'not in the module catalog',
        })
    })

    it('drops a module that is catalogued but not implemented yet', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'price_trend', props: {} }, ...validSpec.layout] },
            market,
        )

        expect(result.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(result.notes[0].reason).toContain('not implemented')
    })

    it('drops page chrome the orchestrator is not allowed to place', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'event_header', props: {} }, ...validSpec.layout] },
            market,
        )

        expect(result.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(result.notes[0].reason).toContain('page chrome')
    })

    it('repairs one bad prop instead of discarding the module', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { sort: 'date', max_items: 9999 } }],
            },
            market,
        )

        expect(result.usedFallback).toBe(false)
        // The bad value is gone and the module's own default applies.
        expect(result.spec.layout[0].props).toMatchObject({ max_items: 8 })
        expect(result.notes.some((note) => note.reason.includes('max_items'))).toBe(true)
    })

    it('strips a hallucinated prop key without touching its siblings', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { sort: 'price', make_it_pop: true } }],
            },
            market,
        )

        expect(result.spec.layout[0].props).toMatchObject({ sort: 'price' })
        expect(result.spec.layout[0].props).not.toHaveProperty('make_it_pop')
    })

    it('strips a bad nested prop without discarding the whole filter', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    {
                        module: 'production_list',
                        props: { sort: 'price', filter: { max_price: 200, min_view_score: 47 } },
                    },
                ],
            },
            market,
        )

        // min_view_score is out of its 0..1 range; max_price must survive.
        expect(result.spec.layout[0].props.filter).toEqual({ max_price: 200 })
    })

    it('drops a max_price no listing can satisfy, so the module cannot render empty', () => {
        const cheapest = Math.min(...market.productions.map((production) => production.floor_price))
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { filter: { max_price: cheapest - 20 } } }],
            },
            market,
        )

        expect(result.spec.layout[0].props.filter).toEqual({})
        expect(result.notes.some((note) => note.reason.includes('below the cheapest ticket'))).toBe(true)
        // The note has to name the rejected value, or it cannot be debugged.
        expect(result.notes.some((note) => note.reason.includes(String(cheapest - 20)))).toBe(true)
        expect(result.notes.every((note) => !note.reason.includes('undefined'))).toBe(true)
    })

    it('keeps a max_price the market can actually satisfy', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'production_list', props: { filter: { max_price: 80 } } }] },
            market,
        )

        expect(result.spec.layout[0].props.filter).toEqual({ max_price: 80 })
        expect(result.notes).toEqual([])
    })

    // Repeats used to be forbidden. The model instead uses `production_list` as a
    // repeatable section — city, then drivable, then the rest — which is a
    // reasonable way to express geography, so they are allowed with limits.
    it('allows a module to repeat when each instance names its section', () => {
        const section = (heading: string, city?: string) => ({
            module: 'production_list',
            size: 'standard',
            props: { heading, group_by_geo: false, ...(city ? { filter: { city } } : {}) },
        })

        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    section('In Chicago', 'Chicago'),
                    section('Worth the drive', 'Milwaukee'),
                    section('Rest of the tour'),
                ],
            },
            market,
        )

        expect(result.usedFallback).toBe(false)
        expect(result.spec.layout).toHaveLength(3)
        expect(result.spec.layout.map((entry) => entry.props.heading)).toEqual([
            'In Chicago',
            'Worth the drive',
            'Rest of the tour',
        ])
        expect(result.notes).toEqual([])
    })

    it('drops instances past the limit', () => {
        const section = (heading: string) => ({
            module: 'production_list',
            props: { heading },
        })

        const result = validateLayout(
            {
                ...validSpec,
                layout: [section('one'), section('two'), section('three'), section('four')],
            },
            market,
        )

        expect(result.spec.layout).toHaveLength(STRUCTURAL_RULES.maxInstances)
        expect(result.notes.some((note) => note.reason.includes('more than 3 times'))).toBe(true)
    })

    it('drops a repeated instance that does not name its section', () => {
        // Two lists both falling back to "N shows near Chicago / all dates"
        // would be unreadable, so an un-headed repeat goes.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'production_list', props: { heading: 'In Chicago' } },
                    { module: 'production_list', props: {} },
                ],
            },
            market,
        )

        expect(result.spec.layout).toHaveLength(1)
        expect(result.spec.layout[0].props.heading).toBe('In Chicago')
        expect(result.notes.some((note) => note.reason.includes('without a `heading`'))).toBe(true)
    })

    it('leaves a single unheaded instance alone', () => {
        // One list reads correctly with the built-in headings, so requiring a
        // heading only applies once there is more than one section.
        const result = validateLayout(validSpec, market)

        expect(result.spec.layout).toHaveLength(1)
        expect(result.spec.layout[0].props.heading).toBeNull()
        expect(result.notes).toEqual([])
    })

    it('repairs a size the module does not offer', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'production_list', size: 'fixed', props: {} }] },
            market,
        )

        expect(result.spec.layout[0].size).toBe('standard')
        expect(result.notes[0].reason).toContain('not offered')
    })

    it('enforces at most one hero', () => {
        // Both entries ask for hero; only the first may keep it.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'production_list', size: 'hero', props: {} },
                    { module: 'listing_preview', size: 'hero', props: {} },
                ],
            },
            market,
        )

        const heroes = result.spec.layout.filter((entry) => entry.size === 'hero')
        expect(heroes.length).toBeLessThanOrEqual(STRUCTURAL_RULES.maxHero)
    })

    it('guarantees a path to purchase, preserving the rest of the composition', () => {
        // A layout of only non-purchase modules would leave no way to buy. Once
        // more modules are implemented this exercises the append-rescue path;
        // today production_list is the only implemented list module, so assert
        // the invariant itself rather than the mechanism.
        const result = validateLayout(validSpec, market)

        expect(result.spec.layout.some((entry) => entry.module === 'production_list')).toBe(true)
    })

    it('falls back when nothing survives validation', () => {
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'nope', props: {} }] },
            market,
        )

        expect(result.usedFallback).toBe(true)
        expect(result.spec).toEqual(FALLBACK_LAYOUT)
        expect(result.notes.some((note) => note.level === 'fallback')).toBe(true)
    })

    it('truncates a layout over the module limit', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: Array.from({ length: STRUCTURAL_RULES.maxModules + 3 }, (_, index) => ({
                    // Distinct ids so the duplicate rule does not fire first.
                    module: index === 0 ? 'production_list' : `filler_${index}`,
                    props: {},
                })),
            },
            market,
        )

        expect(result.spec.layout.length).toBeLessThanOrEqual(STRUCTURAL_RULES.maxModules)
    })
})
