import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import classNames from 'classnames'

import type { ResolvedLayout } from '@/contracts/layout-spec'

import styles from './DemoBar.module.scss'
import type { CompositionSummary } from './summarize'
import { MODE_SLUGS, type DemoMode, type ModeSlug } from './modes'

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
    active: DemoMode
    resolved: ResolvedLayout
    /** What the spec actually produced, next to the reasoning that asked for it. */
    summary: CompositionSummary
    /** The page itself — rendered beside the drawer so opening it pushes right. */
    children: React.ReactNode
}

const MODE_LABEL: Record<ModeSlug, string> = {
    base: 'Base',
    eval: 'Eval',
    custom: 'Custom',
}

const NOTE_CLASS = {
    dropped: styles.noteDropped,
    repaired: styles.noteRepaired,
    fallback: styles.noteFallback,
} as const

const TOGGLE_KEY = 'h'
const DRAWER_KEY = 'genui:drawer'

export const DemoBar: React.FC<DemoBarProps> = ({ active, resolved, summary, children }) => {
    const { provenance, notes, spec } = resolved
    // Remembered for the session rather than held in the URL. Switching mode is
    // a full navigation, so pure local state closed the drawer every time you
    // used it; a query param had the opposite problem — hiding it and then
    // switching mode brought it straight back. sessionStorage does neither.
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setIsOpen(window.sessionStorage.getItem(DRAWER_KEY) === 'open')
    }, [])

    const toggle = () =>
        setIsOpen((open) => {
            const next = !open
            window.sessionStorage.setItem(DRAWER_KEY, next ? 'open' : 'closed')
            return next
        })
    const router = useRouter()
    // The textarea's own value. The composed brief lives in the URL, so this is
    // only the in-progress edit.
    const [draft, setDraft] = useState(active.brief ?? '')

    const submitBrief = (event: React.FormEvent) => {
        event.preventDefault()
        const brief = draft.trim()
        if (!brief) return
        router.push(`/?mode=custom&brief=${encodeURIComponent(brief)}`)
    }

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
            toggle()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <div className={styles.layout}>
            {isOpen && (
                <aside className={styles.drawer} aria-label="Demo controls">
                    <div className={styles.drawerHeader}>
                        <span className={styles.label}>Mode</span>
                        <div className={styles.variants}>
                            {MODE_SLUGS.map((slug) => (
                                <Link
                                    key={slug}
                                    href={slug === 'custom' && draft.trim() ? `/?mode=custom&brief=${encodeURIComponent(draft.trim())}` : `/?mode=${slug}`}
                                    className={classNames(styles.variant, {
                                        [styles.variantActive]: slug === active.slug,
                                    })}
                                >
                                    {MODE_LABEL[slug]}
                                </Link>
                            ))}
                        </div>

                        {/*
                          What the page was actually given. The whole argument
                          rests on the difference between composing for someone
                          and not, so the panel should never leave that implicit.
                        */}
                        <span className={styles.label}>Given to the page</span>
                        <span className={styles.note}>{active.given}</span>
                        {active.brief && <blockquote className={styles.brief}>{active.brief}</blockquote>}

                        {active.slug === 'custom' && (
                            <form className={styles.briefForm} onSubmit={submitBrief}>
                                <textarea
                                    className={styles.briefInput}
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    rows={4}
                                    placeholder="Describe who is landing. Plain sentences — the model reads this."
                                    aria-label="Visitor brief"
                                />
                                <button type="submit" className={styles.variant} disabled={!draft.trim()}>
                                    Compose
                                </button>
                            </form>
                        )}

                        {active.brief && (
                            <Link
                                href={`/?mode=${active.slug}${
                                    active.slug === 'custom' ? `&brief=${encodeURIComponent(active.brief)}` : ''
                                }&fresh=1`}
                                className={styles.variant}
                            >
                                Re-run (new call)
                            </Link>
                        )}

                        <span className={styles.label}>shift+h to hide</span>
                    </div>

                    <div className={styles.panel}>
                        <p className={styles.panelHeading}>Why this page</p>
                        <p className={styles.reasoning}>{spec.reasoning}</p>

                        <p className={styles.panelHeading}>What it composed</p>
                        <ul className={styles.moduleList}>
                            {summary.modules.map((module, index) => (
                                <li key={`${module.module}:${index}`}>
                                    {module.module} <span className={styles.dim}>· {module.size}</span>
                                </li>
                            ))}
                        </ul>

                        {summary.emptySections.length > 0 && (
                            <ul className={styles.notes}>
                                {summary.emptySections.map((section) => (
                                    <li key={section.heading} className={styles.noteRepaired}>
                                        {`empty: ${section.heading} — ${section.reason}`}
                                    </li>
                                ))}
                            </ul>
                        )}

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
                                {provenance.source === 'live' && ' — composed just now, at request time'}
                                {provenance.source === 'precomputed' &&
                                    ' — composed during development, not at request time'}
                            </dd>
                            <dt>model</dt>
                            <dd>{provenance.model ?? '—'}</dd>
                            <dt>prompt</dt>
                            <dd>{provenance.prompt_version ?? '—'}</dd>
                            <dt>generated</dt>
                            <dd>{provenance.generated_at}</dd>
                            {provenance.duration_ms !== null && (
                                <>
                                    <dt>took</dt>
                                    <dd>
                                        {(provenance.duration_ms / 1000).toFixed(1)}s
                                        {provenance.cost_usd !== null &&
                                            ` · $${provenance.cost_usd.toFixed(4)}`}
                                        {provenance.input_tokens !== null &&
                                            ` · ${provenance.input_tokens.toLocaleString('en-US')} in`}
                                    </dd>
                                </>
                            )}
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
