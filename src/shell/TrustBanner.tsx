import React from 'react'

import Typography from '@/design-system/typography'
import { HeartIcon, RewardsIcon, ShieldCheckIcon } from '@/design-system/icons'

import styles from './TrustBanner.module.scss'

/**
 * "Experience it live." — Figma Trust Banner A (17055:179006). The rail's
 * lower block: a headline, a guarantee subtitle, and three trust rows. Copy is
 * verbatim from the design (static brand claims).
 */

const ROWS = [
    { icon: <ShieldCheckIcon />, text: 'Tickets guaranteed to be valid and on time.' },
    { icon: <HeartIcon />, text: 'Loved and trusted by over 30 million fans.' },
    { icon: <RewardsIcon />, text: 'The only ticket rewards program around.' },
]

export const TrustBanner: React.FC = () => (
    <div className={styles.trustBanner}>
        <div className={styles.title}>
            <Typography variant="titleMd" component="p">
                Experience it live.
            </Typography>
            <Typography variant="small" component="p" className={styles.subtitle}>
                100 million sold, 100% Buyer Guarantee.
            </Typography>
        </div>

        <ul className={styles.rows}>
            {ROWS.map((row) => (
                <li key={row.text} className={styles.row}>
                    <span className={styles.icon} aria-hidden>
                        {row.icon}
                    </span>
                    <Typography variant="small" component="span">
                        {row.text}
                    </Typography>
                </li>
            ))}
        </ul>
    </div>
)

export default TrustBanner
