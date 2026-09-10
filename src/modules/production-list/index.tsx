import React from 'react'
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
    excludeItemIds,
}) => {
    // No "see all" escape hatch here. The composition does narrow the list — by
    // budget filter and by max_items — and the visitor still has to be able to
    // reach every date, but that guarantee lives in the shell's FullTourList,
    // which no composition can remove. A copy inside the module just meant two
    // identical buttons stacked on the base variant.
    const { groups, highlightedId } = selectProductions(
        market,
        context,
        props,
        excludeItemIds,
    )

    // An empty section renders nothing at all. An empty state here would be
    // furniture explaining its own absence — the composition simply asked for a
    // collection that has no members, and the page reads better without the
    // apology. The panel reports it instead, which is where it is useful: a
    // section coming back empty is feedback about the composition, not something
    // the visitor needs to know.
    if (groups.length === 0) return null

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
                        {/*
                          An explicit heading wins. The built-in "N shows near X"
                          and "tour dates" headings assume this is the only list
                          on the page; once the orchestrator places several
                          sections, each names itself.
                        */}
                        {props.heading ? (
                            <Typography variant="titleSm" component="h2" className={styles.allHeader}>
                                <span>{props.heading}</span>
                                <span className={styles.sep}>•</span>
                                <span className={styles.count}>
                                    {group.productions.length}{' '}
                                    {group.productions.length === 1 ? 'Show' : 'Shows'}
                                </span>
                            </Typography>
                        ) : group.key === 'near' ? (
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
                                eligibleBadges={props.badges}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </section>
    )
}

export default ProductionList
