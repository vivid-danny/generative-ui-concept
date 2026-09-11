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
    /** Nothing composed for this brief yet — offer Run rather than a re-run. */
    awaitingRun: boolean
    /** Running total from the call ledger, so spending is visible in the UI. */
    spend: { calls: number; costUsd: number; failures: number }
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

/**
 * Runs one composition, and reports on it while it runs.
 *
 * Posts to `/api/compose` — the only path that can call the model — and then
 * refreshes the page's props, which now find the composition in cache. Two
 * requests where there used to be one, and the second is free.
 *
 * Why not navigate and let the server compose, as this did: a navigation is a
 * GET, and Next replays GETs on hot reload and on a cold compile. That is how
 * calls happened that nobody pressed. It also blocked the render for up to
 * three minutes, so a slow call looked identical to a dead page.
 *
 * The elapsed count is the point of the state. A composition takes 30s to over
 * 180s; without a number on screen there is no difference between thinking and
 * broken — which is how three calls got fired on top of each other.
 */
function useCompose(): {
    composing: boolean
    elapsed: number
    error: string | null
    run: (body: { mode: ModeSlug; brief: string | null; fresh?: boolean }) => void
} {
    const router = useRouter()
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [elapsed, setElapsed] = useState(0)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (startedAt === null) return
        const tick = window.setInterval(
            () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
            1000,
        )
        return () => window.clearInterval(tick)
    }, [startedAt])

    const run = (body: { mode: ModeSlug; brief: string | null; fresh?: boolean }) => {
        if (startedAt !== null) return
        setError(null)
        setElapsed(0)
        setStartedAt(Date.now())

        void fetch('/api/compose', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then(async (response) => {
                const payload = (await response.json()) as { error?: string; reason?: string }
                if (!response.ok) {
                    // The page stays as it was rather than going blank. A failed
                    // call still cost money; the ledger has it either way.
                    setError(payload.reason ?? payload.error ?? `call failed (${response.status})`)
                    return
                }
                // Re-read props. The composition is in cache now, so this is free.
                await router.replace(router.asPath, undefined, { scroll: false })
            })
            .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'the request never completed')
            })
            .finally(() => setStartedAt(null))
    }

    return { composing: startedAt !== null, elapsed, error, run }
}

export const DemoBar: React.FC<DemoBarProps> = ({
    active,
    resolved,
    summary,
    awaitingRun,
    spend,
    children,
}) => {
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
    const { composing, elapsed, error, run } = useCompose()

    // Switching to a typed brief is a navigation, not a call: the page loads the
    // baseline for it and waits to be told to compose.
    const submitBrief = (event: React.FormEvent) => {
        event.preventDefault()
        const brief = draft.trim()
        if (!brief || composing) return
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
                                        [styles.variantDisabled]: composing,
                                    })}
                                    // Switching mode is free — it reads cache.
                                    // Still barred mid-call, because navigating
                                    // away from a running composition loses the
                                    // only progress indicator for it.
                                    aria-disabled={composing}
                                    tabIndex={composing ? -1 : undefined}
                                    onClick={(event) => {
                                        if (composing) event.preventDefault()
                                    }}
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
                                <button
                                    type="submit"
                                    className={styles.runButton}
                                    disabled={!draft.trim() || composing}
                                >
                                    {composing ? 'Composing…' : 'Compose'}
                                </button>
                            </form>
                        )}

                        {active.brief && (
                            <button
                                type="button"
                                className={styles.runButton}
                                // Disabled the instant the request starts, not on
                                // completion: the second press is the one that
                                // pays twice.
                                disabled={composing}
                                onClick={() =>
                                    run({
                                        mode: active.slug,
                                        brief: active.brief,
                                        // A composition already exists, so this
                                        // press is asking for a new one.
                                        fresh: !awaitingRun,
                                    })
                                }
                            >
                                {composing
                                    ? 'Composing…'
                                    : awaitingRun
                                      ? 'Run composition (one call)'
                                      : 'Re-run (new call)'}
                            </button>
                        )}

                        {composing && (
                            <p className={styles.composing} role="status" aria-live="polite">
                                <span className={styles.spinner} aria-hidden="true" />
                                <span>
                                    Calling the model — {elapsed}s
                                    <span className={styles.composingHint}>
                                        {elapsed < 120
                                            ? 'usually 30–120s'
                                            : 'the bridge gives up at 180s'}
                                    </span>
                                </span>
                            </p>
                        )}

                        {error && (
                            <p className={styles.composeError} role="alert">
                                {error}
                                <span className={styles.composingHint}>
                                    The page still shows what it had. The call is in
                                    .cache/calls.log either way.
                                </span>
                            </p>
                        )}

                        {/*
                          Spending, in the UI rather than in a server log. The
                          drawer used to report a cost per composition, which
                          made a timed-out call — the most expensive kind, since
                          it buys nothing — leave no trace at all.
                        */}
                        <span className={styles.label}>Spent this machine</span>
                        <span className={styles.note}>
                            {spend.calls} call{spend.calls === 1 ? '' : 's'} · $
                            {spend.costUsd.toFixed(3)}
                            {spend.failures > 0 && ` · ${spend.failures} bought nothing`}
                        </span>

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

                        {summary.signals.map((signals) => (
                            <div key={signals.heading} className={styles.renderedGroup}>
                                <p className={styles.groupLabel}>{`rail: ${signals.heading}`}</p>
                                <ul className={styles.rowList}>
                                    {signals.lines.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}

                        {summary.unshownTopPick !== null && (
                            <ul className={styles.notes}>
                                <li className={styles.noteRepaired}>
                                    {`top pick ${summary.unshownTopPick} was named but no section shows it`}
                                </li>
                            </ul>
                        )}

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
                                            className={classNames({ [styles.rowHighlighted]: row.isTopPick })}
                                        >
                                            {row.date} · {row.city} · from ${row.floorPrice}
                                            {row.isTopPick && <span className={styles.dim}> ← top pick</span>}
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
