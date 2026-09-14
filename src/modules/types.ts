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
    /**
     * The page's recommended date, if the composition named one.
     *
     * Threaded like `excludeItemIds` rather than passed as a prop: it is one
     * decision about the whole page, and a section's only job is to label the
     * row if it happens to be showing it.
     */
    topPick?: string | null
    /**
     * Why that date is the pick, threaded alongside the id for the same reason:
     * the pair is one page-level decision, and the section carries it only as
     * far as the row that happens to be showing it.
     */
    topPickReason?: string | null
    /**
     * The visitor's city as the composition understands it, overriding
     * `context.geo.metro` when set.
     *
     * Threaded rather than passed as a prop for the same reason as `topPick`:
     * where the visitor is, is one fact about the page. Two sections disagreeing
     * about it is not a composition anyone would want to express.
     */
    visitorMetro?: string | null
}
