import React from 'react'
import classNames from 'classnames'

import Tooltip from '@mui/material/Tooltip'

import Typography from '@/design-system/typography'
import type { Production } from '@/contracts/market'

import { badgesFor, type BadgeId, type BadgeTone } from './badges'
import type { CardSignalValue, SignalTone } from './card-signal'
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
 *   worth telling a buyer about, but the signal has to come from the data —
 *   `sellout_risk` and the real `listing_count` — or it demonstrates nothing
 *   about the page responding to live conditions.
 */

export interface ProductionCardProps {
    production: Production
    /** Rendered as the row's title: the page's performer. */
    performerName: string
    /**
     * True on the single row the composition recommends.
     *
     * One per page, decided at the spec level — this card only labels the row if
     * the section it is in happens to be the one showing it.
     */
    isTopPick?: boolean
    /**
     * Why it is the pick, in the model's own words, revealed on hover.
     *
     * Null when the composition did not supply one — the tab renders without a
     * tooltip rather than the card losing its outline, because the
     * recommendation is sound whether or not prose arrived with it.
     */
    topPickReason?: string | null
    /**
     * Badges the section allowed. The row still only shows the ones true of it,
     * so an allowlist never becomes a label every card wears.
     */
    eligibleBadges?: readonly BadgeId[]
    /**
     * The signal beside the CTA, already resolved.
     *
     * The module hands over a label rather than a signal id, because most of
     * the signals compare this row against the others in the section and the
     * card only ever sees one row. Section-level, so every row in a list gets
     * one or none.
     */
    signal?: CardSignalValue | null
}

/** Signal tone -> the card's own styling. Form, so it lives here. */
const SIGNAL_CLASS: Record<SignalTone, string> = {
    good: styles.signalGood,
    neutral: styles.signalNeutral,
    adverse: styles.signalAdverse,
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
    isTopPick = false,
    topPickReason = null,
    eligibleBadges = [],
    signal = null,
}) => {
    const date = new Date(production.date)
    // Which badges the section allowed, narrowed to the ones true of this date.
    const badges = badgesFor(production, eligibleBadges)


    return (
        <article className={classNames(styles.card, { [styles.topPickCard]: isTopPick })}>
            {/*
              First in reading order, so a screen reader announces the
              recommendation before the date — the pink border alone conveyed
              nothing at all. `overline` is the nearest scale entry; the SCSS
              lightens its weight and tracking, and owns the overhang, which has
              to clear the gap between cards.
            */}
            {isTopPick && (
                <Tooltip
                    // Why the reason is not visible copy: the tab sits in the
                    // gap between cards and there is nowhere to put two
                    // sentences that does not push the row around. Hidden by
                    // default also costs the resting state nothing, which is
                    // what makes it affordable on a page this dense.
                    title={topPickReason ?? ''}
                    // An absent reason is a composition that did not supply
                    // one; the tab still earns its place, because the
                    // recommendation stands without the prose.
                    disableHoverListener={topPickReason === null}
                    disableFocusListener={topPickReason === null}
                    disableTouchListener={topPickReason === null}
                    placement="top"
                    arrow
                    enterDelay={120}
                    // Long enough to read two sentences without chasing it.
                    leaveDelay={80}
                    classes={{ tooltip: styles.pickTooltip, arrow: styles.pickTooltipArrow }}
                >
                    <Typography
                        variant="overline"
                        component="span"
                        className={styles.topPick}
                        // Keyboard reaches it only if it is focusable, and a
                        // reason nobody can read without a mouse is half a
                        // feature. `tabIndex` rather than a button: pressing it
                        // does nothing, so a button would promise an action.
                        tabIndex={topPickReason === null ? undefined : 0}
                        aria-describedby={undefined}
                    >
                        Top Pick
                    </Typography>
                </Tooltip>
            )}
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
                  the price into the button freed the slot to its left. The
                  section decides what fills it — the same fact on every row, or
                  nothing at all.
                */}
                {signal && (
                    <Typography
                        variant="caption"
                        component="span"
                        className={classNames(styles.signal, SIGNAL_CLASS[signal.tone])}
                    >
                        {signal.label}
                    </Typography>
                )}
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
