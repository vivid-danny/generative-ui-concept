import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import { SpecProvenanceSchema, type ResolvedLayout } from '@/contracts/layout-spec'

import type { OrchestrationProvider } from './provider'
import { FALLBACK_LAYOUT } from './validate'

/**
 * The baseline: the page as it works today, for everyone.
 *
 * This exists to be contrasted against. A composed page only means something
 * next to the page it replaces, and the source plan asks for exactly this — a
 * "today's flow" reference to demo against.
 *
 * It reuses `FALLBACK_LAYOUT`, which is already `production_list` at standard
 * size, date-sorted and geo-grouped: near you, then all dates. That is what the
 * real performer page does, so there is nothing to build.
 *
 * Note what the baseline still knows: the visitor's city. Today's page does
 * geolocate — that is how "near you" works — and pretending otherwise would be
 * arguing against a page that does not exist. What it does not do is *compose*
 * around the visitor: no budget, no intent, no weighing of one lever against
 * another. That is the difference on display, and it is a fair one.
 *
 * Which is why the baseline wears badges. `fallback-layout.json` names
 * `deals_available` and `tickets_left` explicitly: the real performer page shows
 * those, so a baseline without them would be weaker than the page it stands
 * for, and every comparison after that flatters the composed page. It showed
 * none for a while, but that was a bug rather than a decision — module prop
 * defaults never ran on this path. It carries no `card_signal` and no
 * `top_pick`, because those are ours and today's page has neither. The
 * difference on display should be composition, not decoration.
 */
export class BaseProvider implements OrchestrationProvider {
    readonly name = 'Baseline (today’s page — no composition)'
    readonly isLive = false

    async getLayout(_context: Context, _market: Market): Promise<ResolvedLayout> {
        return {
            spec: {
                ...FALLBACK_LAYOUT,
                reasoning:
                    'No composition happened. This is the page every visitor gets: the dates near you, then the rest of the tour, in calendar order. Nothing about who is landing changed what appears, what order it appears in, or what it emphasises.',
                headline: null,
            },
            provenance: SpecProvenanceSchema.parse({
                generated_at: new Date().toISOString(),
                source: 'fallback',
                model: null,
                prompt_version: null,
                context_id: 'base',
                raw_response: null,
            }),
            notes: [],
        }
    }
}
