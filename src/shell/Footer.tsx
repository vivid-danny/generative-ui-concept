import React from 'react'

import Typography from '@/design-system/typography'

import Logo from './Logo'
import styles from './Footer.module.scss'

const COLUMNS = [
    { heading: 'Connect', links: ['Contact Us', 'Event News', 'Facebook', 'Instagram', 'Twitter'] },
    {
        heading: 'Our Company',
        links: ['About Us', 'Buyer Guarantee', 'Careers', 'Press', 'Investors'],
    },
    {
        heading: 'Our Services',
        links: ['Affiliate Program', 'Fan Forecast™', 'Partners', 'Sell Tickets'],
    },
    { heading: 'Shop', links: ['Gift Cards', 'Refer a Friend', 'Rewards', 'Vivid Seats App'] },
]

const LEGAL_LINKS = ['Accessibility', 'Privacy Policy and Rights', 'Site Map', 'Terms of Use']

/** Static page chrome, built from Figma 17055:179082. Inert, like the navbar. */
export const Footer: React.FC = () => (
    <footer className={styles.footer}>
        <img className={styles.facets} src="/footer-triangles.svg" alt="" aria-hidden />

        <div className={styles.top}>
            <Logo width={168} variant="contrast" />
            <div className={styles.columns}>
                {COLUMNS.map((column) => (
                    <div key={column.heading} className={styles.column}>
                        <Typography
                            variant="overline"
                            component="p"
                            className={styles.columnHeading}
                        >
                            {column.heading}
                        </Typography>
                        {column.links.map((link) => (
                            <Typography key={link} variant="small" component="span">
                                {link}
                            </Typography>
                        ))}
                    </div>
                ))}
            </div>
        </div>

        <hr className={styles.divider} />

        <div className={styles.bottom}>
            <Typography variant="small" component="span">
                ©2026 Vivid Seats LLC. All Rights Reserved.
            </Typography>
            <div className={styles.legal}>
                {LEGAL_LINKS.map((link) => (
                    <Typography key={link} variant="small" component="span">
                        {link}
                    </Typography>
                ))}
            </div>
        </div>
    </footer>
)

export default Footer
