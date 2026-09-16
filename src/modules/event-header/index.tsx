import React from 'react'

import Typography from '@/design-system/typography'

import type { ModuleComponentProps } from '../types'
import styles from './index.module.scss'

/**
 * `event_header` — page chrome, always first, never placed by the orchestrator.
 * Rebuilt from Figma 17055:178925 rather than ported: athena's
 * three candidate components all depend on `@vividseats/vivid-ui-kit`, which is
 * not available here.
 *
 * Type styles are the ones bound to the Figma node — Title XL for the title,
 * Subtitle XL beneath it, Small/Medium in the banner — not guesses.
 */

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

export const EventHeader: React.FC<ModuleComponentProps> = ({ market }) => {
    const { performer, productions } = market

    const dates = [...productions].sort((a, b) => a.date.localeCompare(b.date))
    const first = MONTH_YEAR.format(new Date(dates[0].date))
    const last = MONTH_YEAR.format(new Date(dates[dates.length - 1].date))
    const run = first === last ? first : `${first} – ${last}`

    return (
        <section className={styles.header}>
            <img className={styles.facets} src="/header-triangles.svg" alt="" aria-hidden />

            <div className={styles.inner}>
                <Typography variant="titleXl">{performer.name} Tickets</Typography>
                <Typography variant="subtitleXl" className={styles.subtitle}>
                    {performer.tour_name ?? `${productions.length} dates · ${run}`}
                </Typography>

                {/* Conversion banner — Figma 17055:178931. Static per the design. */}
                <span className={styles.banner}>
                    <Typography variant="smallMedium" component="span">
                        <span aria-hidden>🔥</span> 10,302 fans recently purchased
                    </Typography>
                </span>
            </div>
        </section>
    )
}

export default EventHeader
