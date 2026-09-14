import React from 'react'

import Typography from '@/design-system/typography'
import { CalendarIcon, TicketIcon } from '@/design-system/icons'

import styles from './PerformerFilters.module.scss'

/**
 * <Performer Filters> — Figma 17055:178933. Presentational action chips (Date,
 * Tickets under $100). Rendered as buttons for accessibility even though they
 * do not filter in this concept.
 */

const CHIPS = [
    { label: 'Date', icon: <CalendarIcon width={14} height={14} /> },
    { label: 'Tickets under $100', icon: <TicketIcon width={14} height={14} /> },
]

export const PerformerFilters: React.FC = () => (
    <div className={styles.filters}>
        {CHIPS.map((chip) => (
            <button key={chip.label} type="button" className={styles.chip}>
                <span className={styles.icon} aria-hidden>
                    {chip.icon}
                </span>
                <Typography variant="body" component="span">
                    {chip.label}
                </Typography>
            </button>
        ))}
    </div>
)

export default PerformerFilters
