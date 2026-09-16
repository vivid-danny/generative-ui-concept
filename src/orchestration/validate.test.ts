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
}

/**
 * A spec whose hero carries the pick — where the model now writes it.
 *
 * `top_pick` used to be a spec-level field, so these tests used to spread it
 * onto `validSpec`. It is authored on the hero and lifted by the validator now,
 * which is the behaviour being covered.
 */
const withHeroPick = (props: Record<string, unknown>) => ({
    ...validSpec,
    layout: [{ module: 'production_list', size: 'hero', props: { sort: 'demand', ...props } }],
})

/** A reason of a realistic shape: two short sentences, inside the bounds. */
const REASON =
    'The only Chicago date inside your budget, and the most in-demand night you can reach without flying.'

/**
 * The notes that mean the validator *changed* something.
 *
 * A `gap` note reports a composition rule the validator cannot repair — a page
 * with nothing below its recommendation band — so it is present on any spec
 * carrying a single list, including the minimal `validSpec` most of these tests
 * build on. A test asserting "nothing was touched" is asserting about drops and
 * repairs, not about that.
 */
const changes = (result: ReturnType<typeof validateLayout>) =>
    result.notes.filter((note) => note.level !== 'gap')

describe('validateLayout', () => {
    it('keeps a `visitor_metro` the snapshot has a date in', () => {
        const result = validateLayout({ ...validSpec, visitor_metro: 'Los Angeles' }, market)

        expect(result.spec.visitor_metro).toBe('Los Angeles')
        expect(changes(result)).toEqual([])
    })

    it('normalises `visitor_metro` to the snapshot’s own spelling', () => {
        // `selectProductions` groups on exact string equality, so a casing
        // difference would silently put every date in "away" and head the
        // section after a city it is not showing.
        const result = validateLayout({ ...validSpec, visitor_metro: 'los angeles' }, market)

        expect(result.spec.visitor_metro).toBe('Los Angeles')
    })

    it('drops a `visitor_metro` that is not a city in the snapshot', () => {
        // This one gets printed, so an invented city is worse than none: the
        // header names a place with no rows under it.
        const result = validateLayout({ ...validSpec, visitor_metro: 'Atlantis' }, market)

        expect(result.spec.visitor_metro).toBeNull()
        expect(changes(result)).toEqual([
            {
                level: 'repaired',
                reason: 'dropped `visitor_metro` (`Atlantis` is not a city in this snapshot)',
            },
        ])
    })

    it('leaves `visitor_metro` null when the model says nothing', () => {
        // The baseline's case: nothing composed, so the context's geo stands.
        expect(validateLayout(validSpec, market).spec.visitor_metro).toBeNull()
    })

    it('passes a valid spec through and applies prop defaults', () => {
        const result = validateLayout(validSpec, market)

        expect(result.usedFallback).toBe(false)
        expect(changes(result)).toEqual([])
        expect(result.spec.layout).toHaveLength(1)
        // `group_by_geo` and `max_items` were absent; the module's own defaults fill in.
        expect(result.spec.top_pick).toBeNull()
        expect(result.spec.layout[0].props).toMatchObject({
            sort: 'date',
            group_by_geo: true,
            max_items: 7,
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
            {
                ...validSpec,
                layout: [{ module: 'listing_preview', props: {} }, ...validSpec.layout],
            },
            market,
        )

        expect(result.spec.layout.map((entry) => entry.module)).toEqual(['production_list'])
        expect(result.notes[0].reason).toContain('not implemented')
    })

    it('accepts the rail card and fills in its defaults', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [...validSpec.layout, { module: 'market_signals', props: {} }],
            },
            market,
        )

        expect(changes(result)).toEqual([])
        expect(result.spec.layout[1]).toMatchObject({
            module: 'market_signals',
            size: 'fixed',
            props: {
                stats: ['fan_demand', 'lowest_price', 'selling_out', 'fans_viewing', 'tour_scale'],
            },
        })
    })

    it('does not let a rail module spend the page’s one hero', () => {
        // `market_signals` offers only `fixed`, so the existing size repair
        // handles this — the point of the test is that the main column still
        // has its hero afterwards.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'market_signals', size: 'hero', props: {} },
                    { module: 'production_list', size: 'hero', props: { heading: 'Near you' } },
                ],
            },
            market,
        )

        expect(result.spec.layout[0]).toMatchObject({ module: 'market_signals', size: 'fixed' })
        expect(result.spec.layout[1]).toMatchObject({ module: 'production_list', size: 'hero' })
        expect(result.notes[0].reason).toContain('is not offered')
    })

    it('keeps one module in the rail and drops the rest', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'market_signals', props: { stats: ['fan_demand'] } },
                    { module: 'market_signals', props: { stats: ['selling_out'] } },
                    ...validSpec.layout,
                ],
            },
            market,
        )

        expect(result.spec.layout.map((entry) => entry.module)).toEqual([
            'market_signals',
            'production_list',
        ])
        expect(result.notes[0].reason).toContain('already placed in the right rail')
    })

    it('adds a path to purchase to a page that is only a rail card', () => {
        // The rail card is context, never the way to buy — and it disappears
        // below 1248px, so a page of nothing else would render empty.
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'market_signals', props: {} }] },
            market,
        )

        expect(result.spec.layout.map((entry) => entry.module)).toEqual([
            'market_signals',
            'production_list',
        ])
    })

    it('caps a hero section at three rows, and says so', () => {
        // Prominence and length were two knobs that could argue: a `hero`
        // section of eight rows claims certainty and then reads as a list.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', size: 'hero', props: { max_items: 8 } }],
            },
            market,
        )

        expect(result.spec.layout[0].props.max_items).toBe(3)
        expect(result.notes[0].reason).toContain('a `hero` section holds 3')
        expect(result.notes[0].reason).toContain('8 was asked for')
    })

    it('caps any other section at seven', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', size: 'compact', props: { max_items: 20 } }],
            },
            market,
        )

        expect(result.spec.layout[0].props.max_items).toBe(7)
    })

    it('does not report a cap the model never asked for', () => {
        // A `hero` with no `max_items` gets the schema default of 7, trimmed to
        // 3. Noting that would be noise: the model did not ask for anything.
        const result = validateLayout(
            { ...validSpec, layout: [{ module: 'production_list', size: 'hero', props: {} }] },
            market,
        )

        expect(result.spec.layout[0].props.max_items).toBe(3)
        expect(changes(result)).toEqual([])
    })

    it('drops a top pick that is not a date in this snapshot', () => {
        const result = validateLayout(withHeroPick({ top_pick: 'prod-999' }), market)

        expect(result.spec.top_pick).toBeNull()
        expect(result.notes[0].reason).toContain('not a date in this snapshot')
    })

    it('keeps a top pick that is real', () => {
        const real = market.productions[3].id
        const result = validateLayout(
            withHeroPick({ top_pick: real, top_pick_reason: REASON }),
            market,
        )

        expect(result.spec.top_pick).toBe(real)
        expect(result.spec.top_pick_reason).toBe(REASON)
        expect(changes(result)).toEqual([])
    })

    describe('the pick belongs to the hero', () => {
        it('lifts a pick authored on the hero onto the page', () => {
            const real = market.productions[3].id
            const result = validateLayout(
                withHeroPick({ top_pick: real, top_pick_reason: REASON }),
                market,
            )

            expect(result.spec.top_pick).toBe(real)
            // Lifted off props, not left in both places for the renderer and
            // the demo panel to disagree over.
            expect(result.spec.layout[0].props.top_pick).toBeUndefined()
            expect(result.spec.layout[0].props.top_pick_reason).toBeUndefined()
        })

        it('drops a pick authored on a section that is not the hero', () => {
            const real = market.productions[3].id
            const result = validateLayout(
                {
                    ...validSpec,
                    layout: [
                        {
                            module: 'production_list',
                            size: 'hero',
                            props: { sort: 'demand', heading: 'Top three' },
                        },
                        {
                            module: 'production_list',
                            size: 'standard',
                            props: { sort: 'date', heading: 'The rest', top_pick: real },
                        },
                    ],
                },
                market,
            )

            expect(result.spec.top_pick).toBeNull()
            expect(result.notes.some((note) => note.reason.includes('belongs to the hero'))).toBe(
                true,
            )
        })

        it('survives a second pass, because `replay` re-validates every cached spec', () => {
            // The regression this pins: validation lifts the pick out of the
            // hero's props onto the spec, so a stored composition comes back
            // with the pick page-level and the hero props already stripped.
            // `replay` in `live.ts` runs it through again on every cache read —
            // and a rule that rejected a page-level pick deleted the
            // recommendation off every composition already paid for.
            const real = market.productions[3].id
            const once = validateLayout(
                withHeroPick({ top_pick: real, top_pick_reason: REASON }),
                market,
            )
            const twice = validateLayout(once.spec, market)

            expect(twice.spec.top_pick).toBe(real)
            expect(twice.spec.top_pick_reason).toBe(REASON)
            expect(changes(twice)).toEqual([])
        })

        it('says so when the section holding the pick is dropped', () => {
            // A hero with a pick and no heading is dropped by the repeated-module
            // rule, and the recommendation goes with it. Reported separately,
            // because a note about a missing heading does not imply a lost pick.
            const real = market.productions[3].id
            const result = validateLayout(
                {
                    ...validSpec,
                    layout: [
                        {
                            module: 'production_list',
                            size: 'hero',
                            props: { sort: 'demand', top_pick: real },
                        },
                        {
                            module: 'production_list',
                            size: 'standard',
                            props: { sort: 'date', heading: 'The rest' },
                        },
                    ],
                },
                market,
            )

            expect(result.spec.top_pick).toBeNull()
            expect(result.notes.some((note) => note.reason.includes('went with it'))).toBe(true)
        })

        it('drops a pick on a second hero, which is demoted before the pick is read', () => {
            // `maxHero` is 1, so the second hero becomes a standard section —
            // and a standard section cannot carry the recommendation. This is
            // what makes "one pick per page" hold without being enforced.
            const real = market.productions[3].id
            const result = validateLayout(
                {
                    ...validSpec,
                    layout: [
                        {
                            module: 'production_list',
                            size: 'hero',
                            props: { sort: 'demand', heading: 'Top three' },
                        },
                        {
                            module: 'production_list',
                            size: 'hero',
                            props: { sort: 'date', heading: 'Also hero', top_pick: real },
                        },
                    ],
                },
                market,
            )

            expect(result.spec.top_pick).toBeNull()
            expect(result.notes.some((note) => note.reason.includes('belongs to the hero'))).toBe(
                true,
            )
        })
    })

    describe('the pick and its reason are checked as a pair', () => {
        it('keeps the pick when the reason is missing, and says so', () => {
            // The recommendation is the valuable half and it is still sound.
            // Losing it over missing prose would throw away real judgment — but
            // a required output that went missing has to be visible in the
            // panel rather than inferred from a chip that does nothing.
            const real = market.productions[3].id
            const result = validateLayout(withHeroPick({ top_pick: real }), market)

            expect(result.spec.top_pick).toBe(real)
            expect(result.spec.top_pick_reason).toBeNull()
            expect(result.notes[0].reason).toContain('without a `top_pick_reason`')
        })

        it('drops a reason that has no pick to explain', () => {
            const result = validateLayout(withHeroPick({ top_pick_reason: REASON }), market)

            expect(result.spec.top_pick_reason).toBeNull()
            expect(result.notes[0].reason).toContain('no `top_pick`')
        })

        it('does not fall the whole page back over a reason one character too long', () => {
            // The failure this guards: an all-or-nothing parse threw away a
            // composition that was paid for because its prose was 241 chars.
            const real = market.productions[3].id
            const result = validateLayout(
                withHeroPick({ top_pick: real, top_pick_reason: 'x'.repeat(241) }),
                market,
            )

            expect(result.usedFallback).toBe(false)
            expect(result.spec.layout.length).toBeGreaterThan(0)
            expect(result.spec.top_pick).toBe(real)
            expect(result.spec.top_pick_reason).toBeNull()
            expect(result.notes[0].reason).toContain('dropped `top_pick_reason`')
        })

        it('drops a reason too short to explain anything', () => {
            const real = market.productions[3].id
            const result = validateLayout(
                withHeroPick({ top_pick: real, top_pick_reason: 'Best value.' }),
                market,
            )

            // Stripped back to the schema default rather than shown: a chip
            // that says nothing on hover is worse than one with no tooltip,
            // because the visitor spent the hover.
            expect(result.spec.top_pick_reason).toBeNull()
        })

        it('drops a reason that arrived as markup rather than prose', () => {
            const real = market.productions[3].id
            const result = validateLayout(
                withHeroPick({
                    top_pick: real,
                    top_pick_reason:
                        '**Cheapest** Chicago night on the tour, and the room will be full for it.',
                }),
                market,
            )

            expect(result.spec.top_pick_reason).toBeNull()
        })
    })

    it('turns off geo grouping on a section that names itself', () => {
        // Otherwise the card's header prints the section heading once per group:
        // the same title above the metro group and again above the rest.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    {
                        module: 'production_list',
                        props: { heading: 'Packed nights, under $80', group_by_geo: true },
                    },
                ],
            },
            market,
        )

        expect(result.spec.layout[0].props.group_by_geo).toBe(false)
        expect(result.notes[0].level).toBe('repaired')
        expect(result.notes[0].reason).toContain('group_by_geo')
    })

    it('leaves geo grouping alone on an unnamed section', () => {
        // One list on the page with no heading of its own is exactly what the
        // built-in "N Shows Near Chicago" headings are for.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { group_by_geo: true } }],
            },
            market,
        )

        expect(result.spec.layout[0].props.group_by_geo).toBe(true)
        expect(changes(result)).toEqual([])
    })

    it('strips a bad card signal back to null rather than dropping the section', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { card_signal: 'vibes' } }],
            },
            market,
        )

        expect(result.spec.layout).toHaveLength(1)
        expect(result.spec.layout[0].props.card_signal).toBeNull()
        expect(result.notes[0].level).toBe('repaired')
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
        expect(result.spec.layout[0].props).toMatchObject({ max_items: 7 })
        expect(result.notes.some((note) => note.reason.includes('max_items'))).toBe(true)
    })

    it('strips a hallucinated prop key without touching its siblings', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'production_list', props: { sort: 'price', make_it_pop: true } },
                ],
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
                layout: [
                    { module: 'production_list', props: { filter: { max_price: cheapest - 20 } } },
                ],
            },
            market,
        )

        expect(result.spec.layout[0].props.filter).toEqual({})
        expect(result.notes.some((note) => note.reason.includes('below the cheapest ticket'))).toBe(
            true,
        )
        // The note has to name the rejected value, or it cannot be debugged.
        expect(result.notes.some((note) => note.reason.includes(String(cheapest - 20)))).toBe(true)
        expect(result.notes.every((note) => !note.reason.includes('undefined'))).toBe(true)
    })

    it('keeps a max_price the market can actually satisfy', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [{ module: 'production_list', props: { filter: { max_price: 80 } } }],
            },
            market,
        )

        expect(result.spec.layout[0].props.filter).toEqual({ max_price: 80 })
        expect(changes(result)).toEqual([])
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
        expect(changes(result)).toEqual([])
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
        expect(changes(result)).toEqual([])
    })

    it('notes a page that ends up with only one list', () => {
        // The composition rule is that something sits below the recommendation
        // band. The validator cannot write that section, so it says the page is
        // missing it rather than pretending the page is complete.
        const result = validateLayout(validSpec, market)

        const gap = result.notes.find((note) => note.level === 'gap')
        expect(gap?.reason).toContain('one `production_list`')
        expect(result.spec.layout).toHaveLength(1)
    })

    it('does not note a page that carries a section below the hero', () => {
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'production_list', size: 'hero', props: { heading: 'In Chicago' } },
                    { module: 'production_list', props: { heading: 'Worth the drive' } },
                ],
            },
            market,
        )

        expect(result.notes.some((note) => note.level === 'gap')).toBe(false)
    })

    it('says the page lost its required band when a drop is what left it thin', () => {
        // The expensive half of an un-headed drop, once every page owes a
        // second band: the note above reports a missing heading, and on its own
        // it does not say the page came out thin as a result.
        const result = validateLayout(
            {
                ...validSpec,
                layout: [
                    { module: 'production_list', size: 'hero', props: { heading: 'In Chicago' } },
                    { module: 'production_list', props: { heading: null } },
                ],
            },
            market,
        )

        expect(result.notes.some((note) => note.reason.includes('without a `heading`'))).toBe(true)
        const gap = result.notes.find((note) => note.level === 'gap')
        expect(gap?.reason).toContain('dropped')
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
