import type { ZodIssue } from 'zod'

import {
    MODULE_CATALOG,
    PATH_TO_PURCHASE_MODULE_IDS,
    isModuleId,
    type ModuleId,
    type Size,
} from '@/contracts/module-catalog'
import {
    LayoutSpecSchema,
    type LayoutSpec,
    type ValidationNote,
} from '@/contracts/layout-spec'
import type { Market } from '@/contracts/market'

import fallbackLayoutJson from './fallback-layout.json'

/**
 * Validator — source plan §3.4.
 *
 * Two principles, both deliberate:
 *
 * 1. **Repair, don't discard.** §3.4 says "on any validation failure render the
 *    fallback", but taken literally one bad prop would throw away an otherwise
 *    good composition. So a bad module is dropped and a bad prop is repaired;
 *    the whole-page fallback is reserved for specs that fail structurally.
 * 2. **Every intervention is recorded.** The notes are surfaced in the demo —
 *    a validator that silently fixes things can't be debugged or trusted.
 */

/**
 * §3.4 specifies 3–6 modules. The minimum is 1 while only `production_list` is
 * implemented — a floor of 3 would make every spec fail. Restore it to 3 in
 * slice 2, once the catalog has enough implemented modules to satisfy it.
 */
export const STRUCTURAL_RULES = {
    minModules: 1,
    maxModules: 6,
    maxHero: 1,
} as const

export const FALLBACK_LAYOUT: LayoutSpec = LayoutSpecSchema.parse(fallbackLayoutJson)

export interface ValidationResult {
    spec: LayoutSpec
    notes: ValidationNote[]
    usedFallback: boolean
}

/** Removes the leaf at `path`, so a repair strips one bad prop, not its parent. */
function deleteAtPath(target: unknown, path: (string | number)[]): boolean {
    if (path.length === 0 || target === null || typeof target !== 'object') return false

    const [head, ...rest] = path
    const container = target as Record<string | number, unknown>

    if (rest.length === 0) {
        if (!(head in container)) return false
        delete container[head]
        return true
    }
    return deleteAtPath(container[head], rest)
}

/**
 * Parses props against the module's schema, stripping offending leaves and
 * retrying until it parses or there is nothing left to strip.
 *
 * Stripping is the right repair because every prop in the catalog either has a
 * default or is optional — so removing a bad value falls back to the module's
 * own intent rather than to a guess.
 */
function repairProps(
    moduleId: ModuleId,
    rawProps: Record<string, unknown>,
): { props: Record<string, unknown> | null; repairs: string[] } {
    const schema = MODULE_CATALOG[moduleId].propsSchema
    const working = structuredClone(rawProps)
    const repairs: string[] = []

    // Bounded by the number of props: each pass must strip at least one leaf or
    // it breaks out, so this cannot spin.
    for (let attempt = 0; attempt <= Object.keys(rawProps).length + 1; attempt++) {
        const parsed = schema.safeParse(working)
        if (parsed.success) {
            return { props: parsed.data as Record<string, unknown>, repairs }
        }

        const issues: ZodIssue[] = parsed.error.issues
        let strippedAny = false

        for (const issue of issues) {
            // A `.strict()` schema reports hallucinated keys as a single
            // `unrecognized_keys` issue with an *empty* path and the offending
            // names in `keys` — so these have to be handled explicitly. Treating
            // them like ordinary path issues silently made every invented prop
            // unrepairable, which fell the whole page back to the static layout.
            const targets: (string | number)[][] =
                issue.code === 'unrecognized_keys'
                    ? issue.keys.map((key) => [...issue.path, key] as (string | number)[])
                    : issue.path.length > 0
                      ? [issue.path as (string | number)[]]
                      : []

            for (const path of targets) {
                if (deleteAtPath(working, path)) {
                    strippedAny = true
                    repairs.push(
                        issue.code === 'unrecognized_keys'
                            ? `dropped unrecognised prop \`${path.join('.')}\``
                            : `dropped prop \`${path.join('.')}\` (${issue.message})`,
                    )
                }
            }
        }

        if (!strippedAny) return { props: null, repairs }
    }
    return { props: null, repairs }
}

/**
 * Catches props that are individually valid but nonsensical against this
 * snapshot — the case §3.4 misses. A `max_price` under every floor price passes
 * its schema and renders an empty module, which reads as a broken page.
 */
function repairAgainstMarket(
    moduleId: ModuleId,
    props: Record<string, unknown>,
    market: Market,
): string[] {
    const repairs: string[] = []
    const filter = props.filter as { max_price?: number } | undefined
    if (!filter?.max_price) return repairs

    const cheapest = Math.min(...market.productions.map((production) => production.floor_price))
    if (filter.max_price < cheapest) {
        // Read the value before deleting it — interpolating after the delete
        // reports `undefined` and makes the note useless for debugging.
        const rejected = filter.max_price
        delete filter.max_price
        repairs.push(
            `dropped prop \`filter.max_price\` (${rejected} is below the cheapest ticket in the snapshot, $${cheapest} — would render an empty ${moduleId})`,
        )
    }
    return repairs
}

export function validateLayout(raw: unknown, market: Market): ValidationResult {
    const notes: ValidationNote[] = []

    const parsed = LayoutSpecSchema.safeParse(raw)
    if (!parsed.success) {
        return {
            spec: FALLBACK_LAYOUT,
            usedFallback: true,
            notes: [
                {
                    level: 'fallback',
                    reason: `spec did not match the layout schema: ${parsed.error.issues
                        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
                        .join('; ')}`,
                },
            ],
        }
    }

    const spec = parsed.data
    const kept: LayoutSpec['layout'] = []
    const seen = new Set<string>()
    let heroCount = 0

    for (const entry of spec.layout) {
        if (!isModuleId(entry.module)) {
            notes.push({ level: 'dropped', module: entry.module, reason: 'not in the module catalog' })
            continue
        }
        const definition = MODULE_CATALOG[entry.module]

        if (!definition.implemented) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: 'in the catalog but not implemented yet',
            })
            continue
        }
        if (!definition.orchestrated) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: 'page chrome — rendered by the shell, not placeable in a layout',
            })
            continue
        }
        if (seen.has(entry.module)) {
            notes.push({ level: 'dropped', module: entry.module, reason: 'duplicate of an earlier entry' })
            continue
        }

        let size = entry.size ?? definition.defaultSize
        if (!(definition.sizes as readonly Size[]).includes(size)) {
            notes.push({
                level: 'repaired',
                module: entry.module,
                reason: `size \`${size}\` is not offered; used \`${definition.defaultSize}\``,
            })
            size = definition.defaultSize
        }
        if (size === 'hero' && heroCount >= STRUCTURAL_RULES.maxHero) {
            notes.push({
                level: 'repaired',
                module: entry.module,
                reason: `a hero module was already placed; demoted to \`${definition.defaultSize}\``,
            })
            size = definition.defaultSize
        }

        const { props, repairs } = repairProps(entry.module, entry.props)
        if (props === null) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: `props could not be repaired${repairs.length ? `: ${repairs.join('; ')}` : ''}`,
            })
            continue
        }
        repairs.push(...repairAgainstMarket(entry.module, props, market))
        for (const repair of repairs) {
            notes.push({ level: 'repaired', module: entry.module, reason: repair })
        }

        if (size === 'hero') heroCount++
        seen.add(entry.module)
        kept.push({ module: entry.module, size, props })
    }

    if (kept.length > STRUCTURAL_RULES.maxModules) {
        const dropped = kept.splice(STRUCTURAL_RULES.maxModules)
        for (const entry of dropped) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: `over the ${STRUCTURAL_RULES.maxModules}-module limit`,
            })
        }
    }

    // §3.4: there is always a path to purchase. Appending the default list module
    // preserves the rest of the composition, where falling back would discard it.
    const hasPathToPurchase = kept.some((entry) =>
        (PATH_TO_PURCHASE_MODULE_IDS as readonly string[]).includes(entry.module),
    )
    if (kept.length > 0 && !hasPathToPurchase) {
        const rescue = FALLBACK_LAYOUT.layout[0]
        kept.push(rescue)
        notes.push({
            level: 'repaired',
            module: rescue.module,
            reason: 'no path to purchase in the layout; appended the default list module',
        })
    }

    if (kept.length < STRUCTURAL_RULES.minModules) {
        notes.push({
            level: 'fallback',
            reason: `only ${kept.length} module(s) survived validation, below the minimum of ${STRUCTURAL_RULES.minModules}`,
        })
        return { spec: FALLBACK_LAYOUT, notes, usedFallback: true }
    }

    return {
        spec: { layout: kept, reasoning: spec.reasoning, headline: spec.headline },
        notes,
        usedFallback: false,
    }
}
