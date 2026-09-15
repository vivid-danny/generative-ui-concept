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
 * section that is simply always present rather than a validator rule that
 * patches one back in.
 *
 * It renders the same `production_list` component the orchestrator uses, with
 * every narrowing switched off. Same UI, no second implementation to drift.
 *
 * Two things it deliberately does *not* do:
 *
 * - **It does not exclude what the composition showed.** Dates repeat between
 *   here and the sections above, and that is correct: the composed sections
 *   dedupe against each other because they are one argument split into parts,
 *   while this is the whole tour. A visitor looking for every date expects the
 *   ones they just read to be in it.
 * - **It does not start collapsed.** It used to be a button alone, which left a
 *   page whose composition narrowed hard — a hero of three dates and nothing
 *   else — reading as though it had failed to load. Seven dates in date order
 *   is a floor under how bare the page can get, and the expand control is still
 *   there for the other forty-five.
 */

/** The resting length. Matches a standard composed section, so it reads as one. */
const RESTING_ITEMS = 7

export const FullTourList: React.FC<{ market: Market; context: Context }> = ({
    market,
    context,
}) => {
    const [expanded, setExpanded] = useState(false)
    const total = market.productions.length

    return (
        <div className={styles.expanded}>
            <ProductionList
                market={market}
                context={context}
                size="standard"
                props={{
                    // Everything off: no filter, nothing grouped, and no top
                    // pick — this list is the escape hatch from the
                    // composition, so it does not carry the composition's
                    // recommendation. `topPick` is simply not passed.
                    //
                    // `heading` stays null so the module's own header prints —
                    // "<performer> Tour Dates". Naming it here would make the
                    // shell's section sound like another composed argument,
                    // which is the one thing it is not.
                    //
                    // Expanded, `max_items` exceeds the schema's ceiling of 20
                    // on purpose: that cap exists to stop the orchestrator
                    // producing a wall of dates, and a wall of dates is
                    // precisely what was asked for here.
                    sort: 'date',
                    group_by_geo: false,
                    max_items: expanded ? total : RESTING_ITEMS,
                    heading: null,
                }}
            />
            {total > RESTING_ITEMS && (
                <button
                    type="button"
                    className={styles.trigger}
                    onClick={() => setExpanded((open) => !open)}
                >
                    <Typography variant="smallMedium" component="span">
                        {expanded ? 'Collapse' : `See all ${total} tour dates`}
                    </Typography>
                </button>
            )}
        </div>
    )
}

export default FullTourList
