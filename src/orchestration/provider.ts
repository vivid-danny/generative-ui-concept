import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import type { ResolvedLayout } from '@/contracts/layout-spec'

/**
 * The swappable orchestration seam.
 *
 * Defined on day one so the switch from precomputed specs to a live LLM call is
 * a one-line provider swap and nothing downstream changes. Everything the
 * renderer sees comes through this interface.
 */
export interface OrchestrationProvider {
    /** Shown in the demo's provenance panel, so the viewer knows which is running. */
    readonly name: string
    /** True when composition happens at request time rather than ahead of it. */
    readonly isLive: boolean
    getLayout(context: Context, market: Market): Promise<ResolvedLayout>
}
