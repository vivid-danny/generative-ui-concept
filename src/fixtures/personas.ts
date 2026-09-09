import { ContextSchema, type Context } from '@/contracts/context'

import leahBudget80 from './contexts/leah-budget-80.json'
import leahBudget250 from './contexts/leah-budget-250.json'
import leahNoBudget from './contexts/leah-no-budget.json'

/**
 * The three Leah contexts.
 *
 * These used to be the demo's switcher options. They are not any more — the
 * switcher is Base / Eval / Custom now — but they remain the only structured
 * contexts that differ along exactly one axis, which makes them the right
 * material for asserting that different contexts produce different pages.
 *
 * Everything except `stated_budget` is identical between them, on purpose: any
 * other varying field would confound the comparison.
 */
export interface Persona {
    slug: string
    label: string
    /** What a reader should notice about this one's composition. */
    note: string
    context: Context
}

export const PERSONAS: Persona[] = [
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
