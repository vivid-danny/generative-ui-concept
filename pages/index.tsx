import React from 'react'
import type { GetServerSideProps } from 'next'

import type { Context } from '@/contracts/context'
import type { ResolvedLayout } from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'
import DemoBar from '@/demo/DemoBar'
import { summarizeComposition, type CompositionSummary } from '@/demo/summarize'
import { MARKET, variantBySlug, type DemoVariant } from '@/demo/variants'
import EventHeader from '@/modules/event-header'
import { PrecomputedProvider } from '@/orchestration/precomputed'
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
    variant: DemoVariant
    market: Market
    context: Context
    resolved: ResolvedLayout
    summary: CompositionSummary
}

export default function Home({ variant, market, context, resolved, summary }: HomeProps) {
    return (
        <>
            <DemoBar active={variant} resolved={resolved} summary={summary}>
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
    const variant = variantBySlug(typeof query.variant === 'string' ? query.variant : undefined)
    const provider = new PrecomputedProvider()
    const resolved = await provider.getLayout(variant.context, MARKET)

    return {
        props: {
            variant,
            market: MARKET,
            context: variant.context,
            resolved,
            summary: summarizeComposition(resolved.spec, MARKET, variant.context),
        },
    }
}
