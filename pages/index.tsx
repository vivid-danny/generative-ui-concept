import React from 'react'
import type { GetServerSideProps } from 'next'

import type { Context } from '@/contracts/context'
import type { ResolvedLayout } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import DemoBar from '@/demo/DemoBar'
import { summarizeComposition, type CompositionSummary } from '@/demo/summarize'
import { MARKET, isModeSlug, modeFor, DEFAULT_MODE, type DemoMode } from '@/demo/modes'
import EventHeader from '@/modules/event-header'
import { BaseProvider } from '@/orchestration/base'
import { readComposition } from '@/orchestration/live'
import { readLedger, ledgerTotals } from '@/orchestration/ledger'
import ComposedPage, { hasRegion } from '@/renderer/ComposedPage'
import PageShell from '@/shell/PageShell'
import PerformerFilters from '@/shell/PerformerFilters'
import FullTourList from '@/shell/FullTourList'
import PerformerRail from '@/shell/PerformerRail'
import PerformerTabs from '@/shell/PerformerTabs'
import SeoContent from '@/shell/SeoContent'

import styles from './index.module.scss'

/**
 * The demo page.
 *
 * Composition happens on the server so the page arrives already composed —
 * there is no layout shift, and the eventual live-orchestration swap (Stage 3)
 * happens here, behind `OrchestrationProvider`, without the client changing.
 *
 * `event_header` is rendered by the page rather than from the spec: it is always
 * first and is not the orchestrator's to place (source plan §4). The validator
 * strips it from any layout that tries.
 */

interface HomeProps {
    mode: DemoMode
    market: Market
    context: Context
    resolved: ResolvedLayout
    summary: CompositionSummary
    /**
     * True when this mode has a brief but nothing has been composed for it yet.
     * The page shows the baseline and the drawer offers Run — it does not
     * quietly call the model to fill the gap.
     */
    awaitingRun: boolean
    /** What has been spent so far, from the call ledger. */
    spend: { calls: number; costUsd: number; failures: number }
}

export default function Home({
    mode,
    market,
    context,
    resolved,
    summary,
    awaitingRun,
    spend,
}: HomeProps) {
    return (
        <>
            <DemoBar
                active={mode}
                resolved={resolved}
                summary={summary}
                awaitingRun={awaitingRun}
                spend={spend}
            >
                <PageShell
                    header={
                        <EventHeader
                            market={market}
                            context={context}
                            size="fixed"
                            props={{}}
                            headline={resolved.spec.headline}
                        />
                    }
                    rail={
                        <PerformerRail market={market} composed={hasRegion(resolved.spec, 'rail')}>
                            {/*
                              The rail's own composed column. Same spec, same
                              renderer — it takes the entries whose module lives
                              in the rail, so the orchestrator never has to say
                              where anything goes.
                            */}
                            <ComposedPage
                                spec={resolved.spec}
                                market={market}
                                context={context}
                                region="rail"
                            />
                        </PerformerRail>
                    }
                    seo={<SeoContent market={market} />}
                >
                    <div className={styles.mainStack}>
                        <PerformerTabs />
                        <PerformerFilters />
                        <ComposedPage spec={resolved.spec} market={market} context={context} />
                        {/*
                          Below the composed column, and outside it: a composition
                          narrows, and the ability to browse the whole tour has to
                          survive whatever the orchestrator decided.
                        */}
                        <FullTourList market={market} context={context} />
                    </div>
                </PageShell>
            </DemoBar>
        </>
    )
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async ({ query }) => {
    const slug = isModeSlug(typeof query.mode === 'string' ? query.mode : undefined)
        ? (query.mode as typeof DEFAULT_MODE)
        : DEFAULT_MODE
    const brief = typeof query.brief === 'string' ? query.brief : null
    const mode = modeFor(slug, brief)

    // **Rendering this page cannot call the model.** Base composes nothing by
    // design; eval and custom read the cache and stop there. A GET is
    // replayable — hot reload, a refresh, a second tab, a prefetch — and every
    // unintended call came from one of those re-running this function. Calling
    // lives behind a POST to `/api/compose`, pressed by a person.
    //
    // `?fresh=1` is gone with it. A URL that spends money is the defect.
    const composed = mode.brief === null ? null : await readComposition(mode.context, MARKET, mode.slug)
    const resolved = composed ?? (await new BaseProvider().getLayout(mode.context, MARKET))

    return {
        props: {
            mode,
            market: MARKET,
            context: mode.context,
            resolved,
            summary: summarizeComposition(resolved.spec, MARKET, mode.context),
            awaitingRun: mode.brief !== null && composed === null,
            spend: ledgerTotals(await readLedger()),
        },
    }
}
