import React from 'react'

import Typography from '@/design-system/typography'
import { EyeIcon, FlameIcon, MicrophoneIcon, TicketIcon } from '@/design-system/icons'

import type { ModuleComponentProps } from '../types'
import { CARD_HEADING, resolveSignals, type MarketSignalsProps, type StatIcon } from './signals'

import styles from './index.module.scss'

/**
 * A compact read on the tour as a whole, in the page's right rail.
 *
 * Built against Figma `Frame 19283` (17433:28650) — a heading, a two-up
 * highlight block, then icon rows. That frame is drawn once as "Price Trends",
 * but it is really a stat-row card: three of the catalog's speculative modules
 * (`sellout_urgency`, `price_trend`, and the editorial half of `date_compare`)
 * were the same component with different rows selected, so they collapsed into
 * this one.
 *
 * The orchestrator picks the stats and their order; `signals.ts` owns the
 * heading, every number, and every word of stat copy. This file owns only where
 * things sit — which is why the model passes one ordered array and the card
 * decides that metrics go in the highlight block and facts become rows.
 *
 * Two deliberate deviations from the frame, both about not overclaiming: the
 * title is "Event Trends" rather than "Price Trends", because the stats need not
 * be about price; and prices show whole dollars because the snapshot's floors
 * are integers.
 */

/** Icon key -> glyph. Form, so it lives here rather than in `signals.ts`. */
const ICONS: Record<StatIcon, React.FC<{ width?: number; height?: number }>> = {
    flame: FlameIcon,
    eye: EyeIcon,
    microphone: MicrophoneIcon,
    ticket: TicketIcon,
}

/**
 * Leaf sizes inside the shared 24px icon box, from the design.
 *
 * The frame insets each glyph differently — the flame fills its box, the eye is
 * 21, the microphone 20 — so a single size across all four would be wrong for
 * three of them.
 */
const ICON_SIZE: Record<StatIcon, number> = {
    flame: 24,
    eye: 21,
    microphone: 20,
    ticket: 20,
}

export const MarketSignals: React.FC<ModuleComponentProps<MarketSignalsProps>> = ({
    market,
    props,
}) => {
    const { metrics, facts } = resolveSignals(market, props)

    // Nothing survived — every requested stat was either unknown or has nothing
    // behind it in this snapshot. Render nothing rather than a titled blank, the
    // same call `production_list` makes for an empty section.
    if (metrics.length === 0 && facts.length === 0) return null

    return (
        <section className={styles.card}>
            <Typography variant="titleSm" component="h2" className={styles.heading}>
                {CARD_HEADING}
            </Typography>

            {metrics.length > 0 && (
                <div className={styles.metrics}>
                    {metrics.map((metric) => (
                        <div key={metric.id} className={styles.metric}>
                            <Typography
                                variant="caption"
                                component="span"
                                className={styles.metricLabel}
                            >
                                {metric.label}
                            </Typography>
                            <Typography variant="bodyBold" component="span">
                                {metric.value}
                            </Typography>
                        </div>
                    ))}
                </div>
            )}

            {facts.length > 0 && (
                <ul className={styles.facts}>
                    {facts.map((fact) => {
                        const Icon = ICONS[fact.icon]
                        const size = ICON_SIZE[fact.icon]

                        return (
                            <li key={fact.id} className={styles.fact}>
                                <span className={styles.factIcon} aria-hidden>
                                    <Icon width={size} height={size} />
                                </span>
                                {/*
                                  The frame gives rows 1-2 Subtitle SM (16/20)
                                  and row 3 Body (16/24). One of those is an
                                  authoring slip; `body` wins because it is what
                                  the rail's other stat rows already use.
                                */}
                                <Typography variant="body" component="span">
                                    {fact.text}
                                </Typography>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

export default MarketSignals
