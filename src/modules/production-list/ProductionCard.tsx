import React from 'react'
import classNames from 'classnames'

import Typography from '@/design-system/typography'
import type { Production } from '@/contracts/market'

import styles from './ProductionCard.module.scss'

/**
 * One row of the performer page's date list.
 *
 * Rebuilt against Figma `<Production Card>` (17055:178943) and athena's
 * `src/components/shared/production-listing-row`. Two notes on fidelity:
 *
 * - The Figma card carries no price. This one shows a lead-in price, because
 *   athena's real row does (its `LeadInPriceMobile` child) and because the
 *   slice-1 demo turns on the viewer being able to see *why* a budget changes
 *   the page. Omitting it would be faithful to the frame and useless in the demo.
 * - Badge copy is derived from the snapshot rather than hardcoded. Scarcity is
 *   worth telling a buyer about (§7), but the signal has to come from the data —
 *   `sellout_risk` and the real `listing_count` — or it demonstrates nothing
 *   about the page responding to live conditions.
 */

export interface ProductionCardProps {
    production: Production
    /** Rendered as the row's title: the page's performer. */
    performerName: string
    /** Marks the one row the composition wants the visitor to notice. */
    isHighlighted?: boolean
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** Prices are dropping fast enough to be worth telling the visitor about. */
const DEAL_TREND_THRESHOLD = -0.03

export const ProductionCard: React.FC<ProductionCardProps> = ({
    production,
    performerName,
    isHighlighted = false,
}) => {
    const date = new Date(production.date)
    const showDealBadge = production.price_trend_7d <= DEAL_TREND_THRESHOLD
    const showUrgencyBadge = production.sellout_risk === 'high'

    return (
        <article className={classNames(styles.card, { [styles.highlighted]: isHighlighted })}>
            <div className={styles.dateBlock}>
                <Typography variant="overline" component="span" className={styles.weekday}>
                    {WEEKDAY.format(date)}
                </Typography>
                <Typography variant="smallBold" component="span" className={styles.date}>
                    {MONTH_DAY.format(date)}
                </Typography>
                <Typography variant="small" component="span" className={styles.time}>
                    {TIME.format(date).replace(' ', '')}
                </Typography>
            </div>

            <div className={styles.details}>
                {(showDealBadge || showUrgencyBadge) && (
                    <div className={styles.badges}>
                        {showDealBadge && (
                            <Typography
                                variant="captionMedium"
                                component="span"
                                className={classNames(styles.badge, styles.badgeDeal)}
                            >
                                <span aria-hidden>💰</span> Deals Available
                            </Typography>
                        )}
                        {showUrgencyBadge && (
                            <Typography
                                variant="captionMedium"
                                component="span"
                                className={classNames(styles.badge, styles.badgeUrgency)}
                            >
                                <span aria-hidden>🔥</span>{' '}
                                {production.listing_count.toLocaleString('en-US')} Tickets Left
                            </Typography>
                        )}
                    </div>
                )}

                <Typography variant="smallMedium" className={styles.performer}>
                    {performerName}
                </Typography>
                <Typography variant="small" component="span" className={styles.venue}>
                    {production.venue}
                    <span className={styles.dot}>•</span>
                    {production.city}, {production.state}
                </Typography>
            </div>

            <div className={styles.actions}>
                <div className={styles.leadInPrice}>
                    <Typography variant="caption" component="span" className={styles.priceLabel}>
                        from
                    </Typography>
                    <Typography variant="smallBold" component="span">
                        ${production.floor_price}
                    </Typography>
                </div>
                <button type="button" className={styles.cta}>
                    <Typography variant="small" component="span">
                        Find Tickets
                    </Typography>
                </button>
            </div>
        </article>
    )
}

export default ProductionCard
