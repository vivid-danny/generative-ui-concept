import type { Context } from '@/contracts/context'

/**
 * A stable, readable id for a context.
 *
 * Recorded on every composition's provenance, so a spec in the cache can be
 * traced back to who it was composed for. Budget is the only dimension it keys
 * on, because it is the only structured field that changes what the page can
 * say; the brief varies far more but is prose, and the cache already keys on the
 * whole message.
 *
 * This outlived the spec library it was written for. It used to pick which
 * hand-authored spec to serve, which is why the buckets are coarse — that
 * library is gone and the buckets now only have to be legible in the drawer.
 */
export function specKeyFor(context: Context): string {
    const budget = context.stated_budget
    const bucket = budget === null ? 'no_budget' : budget <= 150 ? 'budget_80' : 'budget_250'

    return `${context.persona_id}/${bucket}`
}
