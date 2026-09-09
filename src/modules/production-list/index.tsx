import React, { useState } from 'react'
import classNames from 'classnames'

import Typography from '@/design-system/typography'
import { ChevronDownIcon } from '@/design-system/icons'

import type { ModuleComponentProps } from '../types'
import ProductionCard from './ProductionCard'
import { selectProductions, type ProductionListProps } from './select'
import styles from './index.module.scss'

/**
 * `production_list` — the performer page's date list, and slice 1's only
 * orchestrated module.
 *
 * Everything visible here is driven by the layout spec's props: which dates
 * survive the filter, what order they are in, which one is highlighted, whether
 * they are grouped by geography, and how many appear. That is the whole point —
 * the same market data has to produce a visibly different page per context.
 */
export const ProductionList: React.FC<ModuleComponentProps<ProductionListProps>> = ({
    market,
    context,
    size,
    props,
}) => {
    // A one-way "see the whole tour" escape hatch. The composition intentionally
    // narrows the list — by budget filter and by max_items — but the visitor
    // should always be able to fall back to every date. Expanding overrides both:
    // it drops the filter and lifts the cap, so "all" means the whole tour, not
    // just what the composition kept.
    const [showAll, setShowAll] = useState(false)
    const composed = selectProductions(market, context, props)
    const total = market.productions.length
    const composedCount = composed.groups.reduce((count, group) => count + group.productions.length, 0)
    const hiddenCount = total - composedCount

    const { groups, highlightedId } = showAll
        ? selectProductions(market, context, { ...props, filter: undefined, max_items: total })
        : composed

    if (groups.length === 0) {
        return (
            <section className={styles.module}>
                <div className={styles.empty}>
                    <Typography variant="body">
                        No dates match this filter. Try raising the budget.
                    </Typography>
                </div>
            </section>
        )
    }

    return (
        <section
            className={classNames(styles.module, {
                [styles.hero]: size === 'hero',
                [styles.compact]: size === 'compact',
            })}
        >
            {groups.map((group) => (
                <div key={group.key} className={styles.group}>
                    <div className={styles.groupHeader}>
                        {group.key === 'near' ? (
                            <Typography variant="titleSm" component="h2" className={styles.geoHeader}>
                                <span>
                                    {group.productions.length}{' '}
                                    {group.productions.length === 1 ? 'Show' : 'Shows'} Near
                                </span>
                                <button type="button" className={styles.geo}>
                                    {context.geo.metro}, {group.productions[0].state}
                                    <ChevronDownIcon width={20} height={20} />
                                </button>
                            </Typography>
                        ) : (
                            <Typography variant="titleSm" component="h2" className={styles.allHeader}>
                                <span>{market.performer.name} Tour Dates</span>
                                <span className={styles.sep}>•</span>
                                <span className={styles.count}>
                                    {group.productions.length}{' '}
                                    {group.productions.length === 1 ? 'Show' : 'Shows'}
                                </span>
                            </Typography>
                        )}
                    </div>
                    <div className={styles.rows}>
                        {group.productions.map((production) => (
                            <ProductionCard
                                key={production.id}
                                production={production}
                                performerName={market.performer.name}
                                isHighlighted={production.id === highlightedId}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/*
              The composition narrows the list, so give the visitor a way back to
              the whole tour. A page that silently drops dates erodes trust in a
              composed page faster than any layout decision — the button is that
              honesty affordance.
            */}
            {!showAll && hiddenCount > 0 && (
                <button type="button" className={styles.showAll} onClick={() => setShowAll(true)}>
                    <Typography variant="smallMedium" component="span">
                        See all {total} tour dates
                    </Typography>
                </button>
            )}
        </section>
    )
}

export default ProductionList
