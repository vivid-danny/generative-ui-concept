import React from 'react'

import { MODULE_CATALOG, type ModuleId } from '@/contracts/module-catalog'
import { MARKET, BASE_CONTEXT } from '@/demo/modes'
import { getModuleComponent } from '@/modules/registry'

/**
 * Module harness — every implemented module rendered at every size it offers,
 * from fixture props (source plan §6, the components agent's deliverable).
 *
 * This is the acceptance surface for visual fidelity: a module passes when it
 * looks at home beside a screenshot of the live page. Keeping it separate from
 * the composed page means fidelity can be judged without the composition
 * getting in the way.
 */

const containerStyle: React.CSSProperties = {
    maxWidth: 812,
    margin: '0 auto',
    padding: '48px 16px 96px',
    display: 'flex',
    flexDirection: 'column',
    gap: 48,
}

const labelStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#717488',
    marginBottom: 12,
}

export default function Harness() {
    const context = BASE_CONTEXT

    return (
        <div style={containerStyle}>
            {(Object.keys(MODULE_CATALOG) as ModuleId[]).map((id) => {
                const definition = MODULE_CATALOG[id]
                const Module = getModuleComponent(id)

                if (!Module) {
                    return (
                        <section key={id}>
                            <p style={labelStyle}>
                                {id} — specified, not implemented ({definition.lever} lever)
                            </p>
                        </section>
                    )
                }

                return (
                    <React.Fragment key={id}>
                        {definition.sizes.map((size) => {
                            // Schema defaults stand in for orchestrator props, so the
                            // harness shows each module in its intended resting state.
                            const props = definition.propsSchema.parse({})
                            return (
                                <section key={`${id}-${size}`}>
                                    <p style={labelStyle}>
                                        {id} · {size}
                                    </p>
                                    <Module
                                        market={MARKET}
                                        context={context}
                                        size={size}
                                        props={props}
                                        headline={null}
                                    />
                                </section>
                            )
                        })}
                    </React.Fragment>
                )
            })}
        </div>
    )
}
