import React from 'react'

import type { Context } from '@/contracts/context'
import type { LayoutSpec } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import { isModuleId } from '@/contracts/module-catalog'
import { getModuleComponent } from '@/modules/registry'
import { resolveExclusions } from '@/modules/production-list/select'

/**
 * Spec -> components. The renderer is dumb (source plan §2, principle 3): it
 * mounts what the validated spec tells it to and makes no decisions of its own.
 *
 * Keys are module ids, never array indices. That is a Stage-4 requirement paid
 * for now: when a re-orchestration reorders the page, React must move the
 * existing nodes rather than unmount and remount them, or "the page sharpens as
 * it learns" will read as a page reload — i.e. as a bug. Retrofitting stable
 * identity later is far more expensive than getting it right here.
 */

interface ComposedPageProps {
    spec: LayoutSpec
    market: Market
    context: Context
}

/**
 * A module's identity across re-orchestrations.
 *
 * The module id alone was enough until a module could be placed more than once.
 * Now that `production_list` can appear as several sections, the id is no longer
 * unique, so the heading joins it: "the drivable-dates list" keeps its identity
 * even if the orchestrator reorders the page or changes its filter.
 *
 * The index is only a last resort, for a repeated module with no heading — which
 * the validator drops, so it should not arrive here. Falling back to it keeps
 * React from warning on duplicate keys if one ever does.
 */
function moduleKey(entry: { module: string; props: Record<string, unknown> }, index: number): string {
    const heading = entry.props.heading
    return typeof heading === 'string' && heading.trim() !== ''
        ? `${entry.module}:${heading}`
        : `${entry.module}:${index}`
}

export const ComposedPage: React.FC<ComposedPageProps> = ({ spec, market, context }) => {
    // Worked out once, in render order, so a date claimed by an earlier section
    // cannot appear again further down the page.
    const exclusions = resolveExclusions(spec.layout, market, context)

    return (
    <>
        {spec.layout.map((entry, index) => {
            // Unreachable for a validated spec — the validator drops unknown and
            // unimplemented modules. Guarded anyway so a renderer bug degrades to
            // a missing module rather than a crashed page.
            if (!isModuleId(entry.module)) return null
            const Module = getModuleComponent(entry.module)
            if (!Module) return null

            return (
                <Module
                    key={moduleKey(entry, index)}
                    market={market}
                    context={context}
                    size={entry.size ?? 'standard'}
                    props={entry.props}
                    headline={spec.headline}
                    excludeItemIds={exclusions[index]}
                />
            )
        })}
    </>
    )
}

export default ComposedPage
