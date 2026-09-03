import type { Context } from '@/contracts/context'
import { ContextSchema } from '@/contracts/context'
import { MarketSchema, type Market } from '@/contracts/market'

import marketJson from '@/fixtures/market.json'
import leahBudget80 from '@/fixtures/contexts/leah-budget-80.json'
import leahBudget250 from '@/fixtures/contexts/leah-budget-250.json'
import leahNoBudget from '@/fixtures/contexts/leah-no-budget.json'

/**
 * The demo's context variants. Selected by `?variant=` — the "minimal demo
 * control" of source plan §5, Stage 1.
 *
 * All three are the same visitor with a different stated budget, and nothing
 * else differs. That is deliberate: the slice-1 claim is "same visitor, same
 * inventory, different budget -> visibly different page", and any other varying
 * field would confound it.
 */

export interface DemoVariant {
    slug: string
    label: string
    /** What a viewer should notice about this variant's composition. */
    note: string
    context: Context
}

export const MARKET: Market = MarketSchema.parse(marketJson)

export const VARIANTS: DemoVariant[] = [
    {
        slug: 'budget-80',
        label: '$80 budget',
        note: 'Only one Chicago night is reachable; the cheaper dates are a drive away.',
        context: ContextSchema.parse(leahBudget80),
    },
    {
        slug: 'budget-250',
        label: '$250 budget',
        note: 'Every date is affordable, so the question becomes which night is worth it.',
        context: ContextSchema.parse(leahBudget250),
    },
    {
        slug: 'no-budget',
        label: 'No budget stated',
        note: 'Nothing is known about price tolerance, so nothing is filtered or recommended.',
        context: ContextSchema.parse(leahNoBudget),
    },
]

export const DEFAULT_VARIANT = VARIANTS[0]

export function variantBySlug(slug: string | undefined): DemoVariant {
    return VARIANTS.find((variant) => variant.slug === slug) ?? DEFAULT_VARIANT
}
