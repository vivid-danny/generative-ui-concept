import type { Context } from '@/contracts/context'
import { ContextSchema } from '@/contracts/context'
import { MarketSchema, type Market } from '@/contracts/market'

import marketJson from '@/fixtures/market.json'
import baseContext from '@/fixtures/contexts/base.json'
import { DEFAULT_EVAL_SCENARIO, evalScenarioBySlug } from '@/fixtures/eval-scenarios'

/**
 * The three things the demo can show, selected by `?mode=`.
 *
 * These replaced a menu of three persona fixtures. The personas were scaffolding
 * from before the model composed on demand: with nothing able to compose at
 * request time, canned contexts paired with canned layouts were the only way to
 * show that context changes the page. That constraint is gone.
 *
 * What is left is the comparison that actually makes the argument — the page as
 * it works today, versus the page composed for someone — plus a way to type who
 * that someone is.
 */

export type ModeSlug = 'base' | 'eval' | 'custom'

export interface DemoMode {
    slug: ModeSlug
    label: string
    /** What the page is actually being given. Stated plainly in the panel. */
    given: string
    context: Context
    /** The brief handed to the model, if any. Null for the baseline. */
    brief: string | null
}

export const MARKET: Market = MarketSchema.parse(marketJson)

/** Geo and nothing else — see `src/orchestration/base.ts` for why. */
export const BASE_CONTEXT: Context = ContextSchema.parse(baseContext)

export const DEFAULT_MODE: ModeSlug = 'base'

export function isModeSlug(value: string | undefined): value is ModeSlug {
    return value === 'base' || value === 'eval' || value === 'custom'
}

/**
 * Builds the mode for this request. `brief` comes from the URL for custom mode
 * and from the scenario for eval mode; base ignores it.
 */
export function modeFor(slug: ModeSlug, brief: string | null): DemoMode {
    if (slug === 'eval') {
        const scenario = evalScenarioBySlug(DEFAULT_EVAL_SCENARIO.slug)
        return {
            slug,
            label: 'Eval',
            given: `Scripted brief — ${scenario.levers}`,
            context: { ...BASE_CONTEXT, brief: scenario.brief },
            brief: scenario.brief,
        }
    }

    if (slug === 'custom' && brief && brief.trim() !== '') {
        const trimmed = brief.trim()
        return {
            slug,
            label: 'Custom',
            given: 'Your typed brief',
            context: { ...BASE_CONTEXT, brief: trimmed },
            brief: trimmed,
        }
    }

    if (slug === 'custom') {
        // Custom with nothing typed yet. Falls through to the baseline rather
        // than paying for a composition of an empty brief.
        return {
            slug,
            label: 'Custom',
            given: 'Nothing typed yet — showing the baseline',
            context: BASE_CONTEXT,
            brief: null,
        }
    }

    return {
        slug: 'base',
        label: 'Base',
        given: 'No visitor context. The same page for everyone.',
        context: BASE_CONTEXT,
        brief: null,
    }
}

/** Ordered for the panel's buttons. */
export const MODE_SLUGS: ModeSlug[] = ['base', 'eval', 'custom']
