import React from 'react'

import Footer from './Footer'
import Navbar from './Navbar'
import styles from './PageShell.module.scss'

interface PageShellProps {
    /** Rendered full-bleed between the navbar and the content grid. */
    header?: React.ReactNode
    /** The composed column — everything the orchestrator placed. */
    children: React.ReactNode
    /** The right rail. Empty in slice 1; the grid reserves its 340px regardless. */
    rail?: React.ReactNode
    /** Full-bleed SEO content rendered below the grid, above the footer. */
    seo?: React.ReactNode
}

/**
 * The performer page shell: navbar, full-bleed header, two-column content grid,
 * footer. Grid values live in PageShell.module.scss.
 *
 * The shell knows nothing about layout specs — it is just the frame the composed
 * column sits in, which keeps the renderer's job (spec -> modules) separate from
 * the page's job (chrome and grid).
 */
export const PageShell: React.FC<PageShellProps> = ({ header, children, rail, seo }) => (
    <div className={styles.page}>
        <Navbar />
        {header}
        <div className={styles.body}>
            <div className={styles.content}>
                <main className={styles.main}>{children}</main>
                <aside className={styles.rail}>{rail}</aside>
            </div>
        </div>
        {seo}
        <Footer />
    </div>
)

export default PageShell
