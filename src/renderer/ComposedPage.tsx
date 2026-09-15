import React from 'react'

import type { Context } from '@/contracts/context'
import type { LayoutSpec } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import { isModuleId, MODULE_CATALOG } from '@/contracts/module-catalog'
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
    /**
     * Which column this instance renders.
     *
     * The page mounts one `ComposedPage` per column and each takes the entries
     * whose module belongs to it. Region is a property of the module, not of the
     * layout entry — the orchestrator places a module and the renderer knows
     * where that module lives (docs/COMPOSABILITY.md: form is not a prop).
     */
    region?: 'main' | 'rail'
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

/**
 * Whether the spec put anything in this column.
 *
 * The page needs to know before rendering — an empty rail column and a rail
 * with a card in it are laid out differently — and `ComposedPage` returning
 * nothing is too late to ask.
 */
export function hasRegion(spec: LayoutSpec, region: 'main' | 'rail'): boolean {
    return spec.layout.some(
        (entry) => isModuleId(entry.module) && MODULE_CATALOG[entry.module].region === region,
    )
}

export const ComposedPage: React.FC<ComposedPageProps> = ({
    spec,
    market,
    context,
    region = 'main',
}) => {
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

            // Filter while mapping, never before it: `exclusions` is aligned to
            // position in the *whole* layout, so filtering the array first would
            // hand each section another section's excluded dates.
            if (MODULE_CATALOG[entry.module].region !== region) return null

            const Module = getModuleComponent(entry.module)
            if (!Module) return null

            return (
                <Module
                    key={moduleKey(entry, index)}
                    market={market}
                    context={context}
                    size={entry.size ?? 'standard'}
                    props={entry.props}
                    excludeItemIds={exclusions[index]}
                    // Only the hero is offered the pick. The validator
                    // already refuses one authored anywhere else, but the pick
                    // can still fall past the hero's three rows — and passing
                    // it on would let the next section down label it, which is
                    // the page-level behaviour this replaced.
                    topPick={entry.size === 'hero' ? spec.top_pick : null}
                    topPickReason={entry.size === 'hero' ? spec.top_pick_reason : null}
                    visitorMetro={spec.visitor_metro}
                />
            )
        })}
    </>
    )
}

export default ComposedPage
