import React from 'react'

import Typography from '@/design-system/typography'
import type { TypographyProps } from '@/design-system/typography'

import styles from './Breadcrumbs.module.scss'

/**
 * Breadcrumb trail — Figma SEO frame (17055:179017), e.g. "Concerts / Pop".
 * Presentational: the trail is data-driven but the links do not navigate in
 * this concept.
 */

export interface BreadcrumbsProps {
    items: string[]
    variant?: TypographyProps['variant']
    className?: string
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, variant = 'caption', className }) => (
    <nav className={className} aria-label="Breadcrumb">
        <ol className={styles.trail}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1
                return (
                    <li key={item} className={styles.crumb} aria-current={isLast ? 'page' : undefined}>
                        <Typography variant={variant} component="span">
                            {item}
                        </Typography>
                        {!isLast && (
                            <span className={styles.separator} aria-hidden>
                                /
                            </span>
                        )}
                    </li>
                )
            })}
        </ol>
    </nav>
)

export default Breadcrumbs
