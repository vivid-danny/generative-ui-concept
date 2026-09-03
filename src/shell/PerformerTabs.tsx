import React from 'react'
import classNames from 'classnames'

import Typography from '@/design-system/typography'

import styles from './PerformerTabs.module.scss'

/**
 * <Tab Collection> — Figma 17055:178932. Presentational: the active tab is
 * fixed. Tickets / Parking, with a full-width rule dividing the strip from the
 * list below it.
 */

const TABS = [
    { label: 'Tickets', active: true },
    { label: 'Parking', active: false },
]

export const PerformerTabs: React.FC = () => (
    <div className={styles.tabs} role="tablist" aria-label="Performer inventory">
        {TABS.map((tab) => (
            <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tab.active}
                className={classNames(styles.tab, { [styles.active]: tab.active })}
            >
                <Typography variant={tab.active ? 'titleMd' : 'subtitleLg'} component="span">
                    {tab.label}
                </Typography>
            </button>
        ))}
    </div>
)

export default PerformerTabs
