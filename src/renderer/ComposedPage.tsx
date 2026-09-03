import React from 'react'

import type { Context } from '@/contracts/context'
import type { LayoutSpec } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import { isModuleId } from '@/contracts/module-catalog'
import { getModuleComponent } from '@/modules/registry'

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

export const ComposedPage: React.FC<ComposedPageProps> = ({ spec, market, context }) => (
    <>
        {spec.layout.map((entry) => {
            // Unreachable for a validated spec — the validator drops unknown and
            // unimplemented modules. Guarded anyway so a renderer bug degrades to
            // a missing module rather than a crashed page.
            if (!isModuleId(entry.module)) return null
            const Module = getModuleComponent(entry.module)
            if (!Module) return null

            return (
                <Module
                    key={entry.module}
                    market={market}
                    context={context}
                    size={entry.size ?? 'standard'}
                    props={entry.props}
                    headline={spec.headline}
                />
            )
        })}
    </>
)

export default ComposedPage
