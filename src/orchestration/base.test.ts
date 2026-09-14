import { describe, expect, it } from 'vitest'

import { ContextSchema } from '@/contracts/context'
import { MarketSchema } from '@/contracts/market'
import baseContext from '@/fixtures/contexts/base.json'
import marketJson from '@/fixtures/market.json'
import { badgesFor } from '@/modules/production-list/badges'
import { selectProductions, type ProductionListProps } from '@/modules/production-list/select'

import { BaseProvider } from './base'

/**
 * The baseline is the control the whole demo is argued against, so what it does
 * and does not do has to be a decision rather than an accident.
 *
 * It was an accident for a while. `BaseProvider` spreads `FALLBACK_LAYOUT`,
 * which was built by parsing JSON through `LayoutSpecSchema` alone — and
 * `LayoutEntrySchema.props` is an open record, so no module `propsSchema` ever
 * ran and none of its defaults applied. Two visible consequences: `highlight`
 * arrived as `undefined` rather than `null`, slipped a `=== null` guard, and
 * drew a pink outline around whichever row sorted first; and `badges` defaulted
 * to nothing, so the baseline wore none while the real performer page does.
 */

const market = MarketSchema.parse(marketJson)
const context = ContextSchema.parse(baseContext)

describe('BaseProvider', () => {
    it('applies module prop defaults, which the schema parse alone did not', async () => {
        const { spec } = await new BaseProvider().getLayout(context, market)
        const props = spec.layout[0].props as unknown as ProductionListProps

        // Every key the module declares is present and typed, not `undefined`.
        expect(props.sort).toBe('date')
        expect(props.group_by_geo).toBe(true)
        expect(props.card_signal).toBeNull()
    })

    it('recommends nothing — a page with no visitor context has nothing to recommend', async () => {
        const { spec } = await new BaseProvider().getLayout(context, market)
        const selection = selectProductions(
            market,
            context,
            spec.layout[0].props as unknown as ProductionListProps,
            undefined,
            spec.top_pick,
        )

        expect(spec.top_pick).toBeNull()
        expect(selection.topPickId).toBeNull()
    })

    it('wears the badges the real page wears', async () => {
        // Deliberate, and stated in `fallback-layout.json` rather than inherited:
        // a baseline without the badges today's page shows would be weaker than
        // the page it stands for, and every comparison after that would flatter
        // the composed page. The difference on display is composition, not
        // decoration.
        const { spec } = await new BaseProvider().getLayout(context, market)
        const props = spec.layout[0].props as unknown as ProductionListProps

        expect(props.badges).toEqual(['deals_available', 'tickets_left'])

        const selection = selectProductions(market, context, props)
        const shown = selection.groups.flatMap((group) => group.productions)
        const withBadges = shown.filter(
            (production) => badgesFor(production, props.badges ?? []).length > 0,
        )

        // The baseline's section wears them.
        expect(withBadges.length).toBeGreaterThan(0)

        // And they stay conditional — a badge has to be true of the date.
        // Asserted against the whole snapshot rather than against this section,
        // because the section is now scoped to the visitor's city and every
        // Chicago date happens to earn one. Checking "not all of them" inside
        // three rows was testing the fixture, not the rule.
        const unbadged = market.productions.filter(
            (production) => badgesFor(production, props.badges ?? []).length === 0,
        )
        expect(unbadged.length).toBeGreaterThan(0)
    })
})
