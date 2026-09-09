import React from 'react'
import type { GetServerSideProps } from 'next'

import type { ResolvedLayout } from '@/contracts/layout-spec'
import { summarizeComposition, type CompositionSummary } from '@/demo/summarize'
import { MARKET } from '@/demo/modes'
import { PERSONAS, type Persona } from '@/fixtures/personas'
import { PrecomputedProvider } from '@/orchestration/precomputed'

/**
 * Spec diff — the guard against the most likely failure mode of LLM
 * composition: converging on one safe layout for every visitor.
 *
 * "Four personas produce four visibly different pages" is the claim the whole
 * prototype rests on, and nothing else in the build checks it. This page makes
 * it inspectable in one screen, and doubles as demo material.
 */

interface DiffProps {
    rows: {
        slug: string
        label: string
        note: string
        resolved: ResolvedLayout
        /** What actually renders, not just what the spec says. */
        summary: CompositionSummary
    }[]
    identical: boolean
}

const mono: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.6,
}

export default function Diff({ rows, identical }: DiffProps) {
    return (
        <div style={{ ...mono, padding: 32, background: '#0d1117', color: '#e6edf3', minHeight: '100vh' }}>
            <h1 style={{ fontSize: 16, marginTop: 0 }}>Composition diff</h1>
            <p
                style={{
                    padding: 12,
                    borderRadius: 4,
                    background: identical ? 'rgba(255,123,114,0.15)' : 'rgba(63,185,80,0.15)',
                    color: identical ? '#ff7b72' : '#3fb950',
                }}
            >
                {identical
                    ? 'FAIL — every context produced the same composition. The page is not responding to context.'
                    : 'PASS — each context produced a different composition.'}
            </p>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
                {rows.map((row) => (
                    <div key={row.slug} style={{ padding: 16, borderRadius: 6, background: '#161b22' }}>
                        <p style={{ margin: '0 0 4px', color: '#ce3197', fontWeight: 700 }}>{row.label}</p>
                        <p style={{ margin: '0 0 16px', color: '#7d8590' }}>{row.note}</p>

                        <p style={{ margin: '0 0 4px', color: '#7d8590' }}>SPEC</p>
                        <pre style={{ margin: '0 0 16px', overflow: 'auto' }}>
                            {JSON.stringify(row.resolved.spec.layout, null, 1)}
                        </pre>

                        <p style={{ margin: '0 0 4px', color: '#7d8590' }}>RENDERS AS</p>
                        {row.summary.groups.map((group) => (
                            <div key={group.label} style={{ marginBottom: 8 }}>
                                <p style={{ margin: 0, color: '#58a6ff' }}>{group.label}</p>
                                <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {group.rows.map((rendered) => (
                                        <li
                                            key={rendered.id}
                                            style={rendered.isHighlighted ? { color: '#ce3197' } : undefined}
                                        >
                                            {rendered.date} · {rendered.city} · from ${rendered.floorPrice}
                                            {rendered.isHighlighted && ' ← highlighted'}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {row.summary.filteredOut > 0 && (
                            <p style={{ color: '#d29922' }}>{row.summary.filteredOut} date(s) filtered out</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export const getServerSideProps: GetServerSideProps<DiffProps> = async () => {
    const provider = new PrecomputedProvider()

    const rows = await Promise.all(
        PERSONAS.map(async (variant: Persona) => {
            const resolved = await provider.getLayout(variant.context, MARKET)

            return {
                slug: variant.slug,
                label: variant.label,
                note: variant.note,
                resolved,
                summary: summarizeComposition(resolved.spec, MARKET, variant.context),
            }
        }),
    )

    const fingerprints = new Set(rows.map((row) => JSON.stringify(row.resolved.spec.layout)))

    return { props: { rows, identical: fingerprints.size === 1 } }
}
