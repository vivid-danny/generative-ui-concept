import React, { useState } from 'react'

import Typography from '@/design-system/typography'
import { MicrophoneIcon, UserIcon } from '@/design-system/icons'
import type { Market } from '@/contracts/market'

import TrustBanner from './TrustBanner'
import styles from './PerformerRail.module.scss'

/**
 * The performer page's right rail — Figma `rightCol` (17055:178973): a square
 * performer image with a favourite control, a stats block, then the
 * "Experience it live" trust banner.
 *
 * Shell chrome, not a module: the orchestrator does not place it, and its
 * contents do not vary by context.
 */

// Static social-proof figure from the design (no snapshot field backs it).
const FANS_SHOPPING_NOW = 343

export const PerformerRail: React.FC<{ market: Market }> = ({ market }) => {
    const { performer, productions } = market
    const cities = new Set(productions.map((production) => production.city)).size

    // Performer art is a committed local asset. The fallback stays because a
    // missing or renamed file should degrade to the brand wash and initial
    // rather than a broken-image icon.
    const [imageFailed, setImageFailed] = useState(false)
    const showImage = Boolean(performer.image_url) && !imageFailed

    return (
        <div className={styles.rail}>
            <div className={styles.imageContainer}>
                {showImage ? (
                    <img
                        src={performer.image_url}
                        alt={performer.name}
                        className={styles.image}
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <span className={styles.initial} aria-hidden>
                        {performer.name.charAt(0)}
                    </span>
                )}
                <button type="button" className={styles.favorite} aria-label={`Favorite ${performer.name}`}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false">
                        <path
                            d="M4 0.5H36C37.933 0.5 39.5 2.067 39.5 4V36C39.5 37.933 37.933 39.5 36 39.5H4C2.067 39.5 0.5 37.933 0.5 36V4C0.500001 2.067 2.067 0.5 4 0.5Z"
                            fill="white"
                            stroke="#CE3197"
                        />
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M20.0003 27L13.1825 19.8885C11.9537 18.6605 11.6491 16.7834 12.4267 15.2298C13.0066 14.07 14.1086 13.2598 15.3885 13.0521C16.6683 12.8445 17.9699 13.2647 18.8868 14.1815L20.0003 15.578L21.1139 14.1815C22.0307 13.2647 23.3323 12.8445 24.6122 13.0521C25.892 13.2598 26.994 14.07 27.574 15.2298C28.3504 16.7828 28.0463 18.6584 26.8188 19.8864L20.0003 27Z"
                            stroke="#CE3197"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>

            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.statIcon} aria-hidden>
                        <MicrophoneIcon />
                    </span>
                    <Typography variant="body" component="span">
                        {productions.length} Tour Dates
                        <span className={styles.dot}>•</span>
                        {cities} Cities
                    </Typography>
                </div>

                <div className={styles.stat}>
                    <span className={styles.statIcon} aria-hidden>
                        <UserIcon />
                    </span>
                    <Typography variant="body" component="span">
                        {FANS_SHOPPING_NOW} Fans shopping tickets now
                    </Typography>
                </div>
            </div>

            <hr className={styles.divider} />

            <TrustBanner />
        </div>
    )
}

export default PerformerRail
