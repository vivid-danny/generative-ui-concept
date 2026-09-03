import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import classNames from 'classnames'

import type { ResolvedLayout } from '@/contracts/layout-spec'

import styles from './DemoBar.module.scss'
import type { CompositionSummary } from './summarize'
import { VARIANTS, type DemoVariant } from './variants'

/**
 * Demo chrome: the context switcher and the provenance panel. Not part of the
 * product being argued for, and styled so that is obvious at a glance.
 *
 * **Hidden by default — press Shift+H to show or hide it.** It opens as a left
 * drawer that pushes the page to the right rather than stacking above it: the
 * previous top bar shoved the product down the viewport, so switching context
 * meant closing the panel just to see what changed.
 *
 * Visibility is local state only, and starts closed. It is deliberately not
 * reflected in the URL: a query param survives navigation, which meant hiding
 * the bar and then switching context brought it straight back.
 *
 * The provenance half exists because slice 1 composes ahead of time rather than
 * at request time. "An LLM composed this" would otherwise be an unverifiable
 * claim; here the model, prompt version, generation timestamp and raw response
 * are on screen, alongside every drop or repair the validator made.
 */

interface DemoBarProps {
    active: DemoVariant
    resolved: ResolvedLayout
    /** What the spec actually produced, next to the reasoning that asked for it. */
    summary: CompositionSummary
    /** The page itself — rendered beside the drawer so opening it pushes right. */
    children: React.ReactNode
}

const NOTE_CLASS = {
    dropped: styles.noteDropped,
    repaired: styles.noteRepaired,
    fallback: styles.noteFallback,
} as const

const TOGGLE_KEY = 'h'

export const DemoBar: React.FC<DemoBarProps> = ({ active, resolved, summary, children }) => {
    const { provenance, notes, spec } = resolved
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
            if (event.key.toLowerCase() !== TOGGLE_KEY) return

            // Don't steal the keystroke from a field. No module takes text input
            // yet, but `budget_entry` will, and a shortcut that eats a capital H
            // mid-typing is a nasty thing to debug later.
            const target = event.target as HTMLElement | null
            if (target?.isContentEditable) return
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

            event.preventDefault()
            setIsOpen((open) => !open)
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <div className={styles.layout}>
            {isOpen && (
                <aside className={styles.drawer} aria-label="Demo controls">
                    <div className={styles.drawerHeader}>
                        <span className={styles.label}>Context</span>
                        <div className={styles.variants}>
                            {VARIANTS.map((variant) => (
                                <Link
                                    key={variant.slug}
                                    href={`/?variant=${variant.slug}`}
                                    className={classNames(styles.variant, {
                                        [styles.variantActive]: variant.slug === active.slug,
                                    })}
                                >
                                    {variant.label}
                                </Link>
                            ))}
                        </div>
                        <span className={styles.note}>{active.note}</span>
                        <span className={styles.label}>shift+h to hide</span>
                    </div>

                    <div className={styles.panel}>
                        <p className={styles.panelHeading}>Why this page</p>
                        <p className={styles.reasoning}>{spec.reasoning}</p>

                        <p className={styles.panelHeading}>What it composed</p>
                        <ul className={styles.moduleList}>
                            {summary.modules.map((module) => (
                                <li key={module.module}>
                                    {module.module} <span className={styles.dim}>· {module.size}</span>
                                </li>
                            ))}
                        </ul>

                        <p className={styles.tally}>
                            {summary.shown} of {summary.total} dates shown
                            {summary.filteredOut > 0 && (
                                <span className={styles.dim}>
                                    {` · ${summary.filteredOut} removed by the filter`}
                                </span>
                            )}
                        </p>

                        {summary.groups.map((group) => (
                            <div key={group.label} className={styles.renderedGroup}>
                                <p className={styles.groupLabel}>{group.label}</p>
                                <ul className={styles.rowList}>
                                    {group.rows.map((row) => (
                                        <li
                                            key={row.id}
                                            className={classNames({ [styles.rowHighlighted]: row.isHighlighted })}
                                        >
                                            {row.date} · {row.city} · from ${row.floorPrice}
                                            {row.isHighlighted && <span className={styles.dim}> ← highlighted</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}

                        <p className={styles.panelHeading}>Provenance</p>
                        <dl className={styles.kv}>
                            <dt>source</dt>
                            <dd>
                                {provenance.source}
                                {provenance.source === 'precomputed' &&
                                    ' — composed during development, not at request time'}
                            </dd>
                            <dt>model</dt>
                            <dd>{provenance.model ?? '—'}</dd>
                            <dt>prompt</dt>
                            <dd>{provenance.prompt_version ?? '—'}</dd>
                            <dt>generated</dt>
                            <dd>{provenance.generated_at}</dd>
                        </dl>

                        <p className={styles.panelHeading}>Validator</p>
                        {notes.length === 0 ? (
                            <p className={styles.kv}>spec passed unmodified</p>
                        ) : (
                            <ul className={styles.notes}>
                                {notes.map((note, index) => (
                                    <li key={`${note.level}-${note.module ?? index}`} className={NOTE_CLASS[note.level]}>
                                        [{note.level}] {note.module ? `${note.module}: ` : ''}
                                        {note.reason}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <p className={styles.panelHeading}>Raw model output</p>
                        <pre className={styles.raw}>{provenance.raw_response ?? '(static fallback — no model output)'}</pre>
                    </div>
                </aside>
            )}

            <div className={styles.content}>{children}</div>
        </div>
    )
}

export default DemoBar
