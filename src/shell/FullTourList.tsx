import React, { useState } from 'react'

import Typography from '@/design-system/typography'
import type { Context } from '@/contracts/context'
import type { Market } from '@/contracts/market'
import ProductionList from '@/modules/production-list'

import styles from './FullTourList.module.scss'

/**
 * The standing guarantee that a customer can always browse the whole tour.
 *
 * Shell chrome, deliberately — not a module. A composed page narrows: it filters
 * by budget, scopes sections to cities, caps how many dates show. That is the
 * point of it. But "I can still see everything" has to be true of the page
 * regardless of what the orchestrator decided, and anything the orchestrator
 * places it can also leave out. Putting the affordance here means no composition
 * can remove it, and the answer to "can they still see all the dates?" is a
 * control that is simply always present rather than a validator rule that
 * patches one back in.
 *
 * It renders the same `production_list` component the orchestrator uses, with
 * every narrowing switched off. Same UI, no second implementation to drift.
 */
export const FullTourList: React.FC<{ market: Market; context: Context }> = ({
    market,
    context,
}) => {
    const [expanded, setExpanded] = useState(false)
    const total = market.productions.length

    if (!expanded) {
        return (
            <button type="button" className={styles.trigger} onClick={() => setExpanded(true)}>
                <Typography variant="smallMedium" component="span">
                    See all {total} tour dates
                </Typography>
            </button>
        )
    }

    return (
        <div className={styles.expanded}>
            <ProductionList
                market={market}
                context={context}
                size="standard"
                headline={null}
                props={{
                    // Everything off: no filter, nothing grouped, nothing capped,
                    // and no top pick — this list is the escape hatch from the
                    // composition, so it does not carry the composition's
                    // recommendation. `topPick` is simply not passed.
                    // `max_items` exceeds the schema's ceiling of 20 on purpose —
                    // that cap exists to stop the orchestrator producing a wall of
                    // dates, and a wall of dates is precisely what was asked for.
                    sort: 'date',
                    group_by_geo: false,
                    max_items: total,
                    heading: 'All tour dates',
                }}
            />
            <button type="button" className={styles.trigger} onClick={() => setExpanded(false)}>
                <Typography variant="smallMedium" component="span">
                    Collapse
                </Typography>
            </button>
        </div>
    )
}

export default FullTourList
