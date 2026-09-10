import React from 'react'
import classNames from 'classnames'

import Typography from '@/design-system/typography'
import type { Production } from '@/contracts/market'

import { badgesFor, type BadgeId, type BadgeTone } from './badges'
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
    /**
     * Badges the section allowed. The row still only shows the ones true of it,
     * so an allowlist never becomes a label every card wears.
     */
    eligibleBadges?: readonly BadgeId[]
}

/** Badge tone -> the card's own styling. Form, so it lives here. */
const TONE_CLASS: Record<BadgeTone, string> = {
    value: styles.badgeDeal,
    scarcity: styles.badgeUrgency,
    popularity: styles.badgePopularity,
    time: styles.badgeTime,
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export const ProductionCard: React.FC<ProductionCardProps> = ({
    production,
    performerName,
    isHighlighted = false,
    eligibleBadges = [],
}) => {
    const date = new Date(production.date)
    // Which badges the section allowed, narrowed to the ones true of this date.
    const badges = badgesFor(production, eligibleBadges)

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
                {badges.length > 0 && (
                    <div className={styles.badges}>
                        {badges.map((badge) => (
                            <Typography
                                key={badge.id}
                                variant="captionMedium"
                                component="span"
                                className={classNames(styles.badge, TONE_CLASS[badge.tone])}
                            >
                                <span aria-hidden>{badge.icon}</span> {badge.label(production)}
                            </Typography>
                        ))}
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
                {/*
                  The CTA carries the get-in price. "Find Tickets" told a visitor
                  nothing they did not know from being on this page, and folding
                  the price into the button frees the slot to its left for
                  something that earns it. Left empty deliberately — what goes
                  there is a decision of its own.
                */}
                <button type="button" className={styles.cta}>
                    <Typography variant="smallMedium" component="span">
                        From ${production.floor_price}
                    </Typography>
                </button>
            </div>
        </article>
    )
}

export default ProductionCard
