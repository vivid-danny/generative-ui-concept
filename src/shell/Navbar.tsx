import React from 'react'

import Typography from '@/design-system/typography'

import Logo from './Logo'
import styles from './Navbar.module.scss'

const NAV_LINKS = ['Explore', 'Trending', 'Sports', 'Concerts', 'Theater & Comedy']

/**
 * Static page chrome, built from Figma 17055:178920.
 *
 * Deliberately inert — no search, no auth, no navigation. Its whole job is to
 * make a screenshot of this page read as vividseats.com, which is load-bearing
 * for the demo.
 */
export const Navbar: React.FC = () => (
    <header>
        <div className={styles.banner}>
            <Typography variant="captionMedium">
                Tickets you can trust: over 190 million sold, 100% Buyer Guarantee.{' '}
                <strong>Learn More.</strong>
            </Typography>
        </div>

        <nav className={styles.bar} aria-label="Main">
            <Logo width={152} />

            <div className={styles.search} aria-hidden>
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m16.5 16.5 4 4" />
                </svg>
                <Typography variant="body" component="span">
                    Search by artist, team, or venue
                </Typography>
            </div>

            <div className={styles.links}>
                {NAV_LINKS.map((link) => (
                    <Typography key={link} variant="body" component="span" className={styles.link}>
                        {link}
                    </Typography>
                ))}
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
                </svg>
            </div>
        </nav>
    </header>
)

export default Navbar
