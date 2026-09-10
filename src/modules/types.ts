import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import type { Size } from '@/contracts/module-catalog'

/**
 * What every module component receives.
 *
 * `props` is the module's own validated props from the layout spec; `market` and
 * `context` are ambient. Modules are pure presentation over these three inputs —
 * source plan §2, principle 3: the renderer is dumb, all intelligence upstream.
 */
export interface ModuleComponentProps<P = Record<string, unknown>> {
    market: Market
    context: Context
    size: Size
    props: P
    /** Page-level framing line from the spec, if the orchestrator wrote one. */
    headline: string | null
    /**
     * Items an earlier section on this page already showed.
     *
     * A layout-level concern rather than a prop: whether a date is still
     * available to a section depends on its siblings, which the orchestrator
     * cannot be asked to track and should not have to.
     */
    excludeItemIds?: ReadonlySet<string>
}
