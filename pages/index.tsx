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
import { LiveProvider } from '@/orchestration/live'
import { PrecomputedProvider } from '@/orchestration/precomputed'
import type { OrchestrationProvider } from '@/orchestration/provider'
import ComposedPage from '@/renderer/ComposedPage'
import PageShell from '@/shell/PageShell'
import PerformerFilters from '@/shell/PerformerFilters'
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
}

export default function Home({ mode, market, context, resolved, summary }: HomeProps) {
    return (
        <>
            <DemoBar active={mode} resolved={resolved} summary={summary}>
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
                    rail={<PerformerRail market={market} />}
                    seo={<SeoContent market={market} />}
                >
                    <div className={styles.mainStack}>
                        <PerformerTabs />
                        <PerformerFilters />
                        <ComposedPage spec={resolved.spec} market={market} context={context} />
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

    // Base makes no call at all. Eval and custom go to the model, but only when
    // there is a brief to compose from and no cached answer — see
    // `src/orchestration/cache.ts`.
    const provider =
        mode.brief === null
            ? new BaseProvider()
            : new LiveProvider({ mode: mode.slug, fresh: query.fresh === '1' })

    const resolved = await provider.getLayout(mode.context, MARKET)

    return {
        props: {
            mode,
            market: MARKET,
            context: mode.context,
            resolved,
            summary: summarizeComposition(resolved.spec, MARKET, mode.context),
        },
    }
}
