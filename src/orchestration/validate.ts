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
    /**
     * How many times one module may appear.
     *
     * Repeats were forbidden outright at first, on the assumption that one
     * module meant one page region. The model disagreed: handed a national tour,
     * it placed `production_list` three times — the visitor's city, then
     * drivable dates, then the rest — which is a good way to express geography
     * with the vocabulary it has. Two of the three were being dropped and the
     * page rendered a third of what the reasoning described.
     *
     * Capped at 3 because past that a page is a wall of lists.
     */
    maxInstances: 3,
    /**
     * How many modules a column other than the main one may hold.
     *
     * A hard rule rather than prompt guidance, per docs/COMPOSABILITY.md: three
     * stacked cards in a 340px rail is a wrong page, not a judgment about this
     * visitor. The main column is exempt — `maxModules` already governs it, and
     * sections stacking there is the point.
     */
    maxPerSideRegion: 1,
    /**
     * How many rows a section may show, by the prominence it was given.
     *
     * A count is a claim about confidence: three dates read as a recommendation,
     * eight read as a list that was not finished narrowing. Deriving the cap
     * from `size` means the model chooses how sure it is and the count follows,
     * instead of prominence and length being two knobs that can argue — which
     * is what a `hero` section of eight was doing.
     *
     * Enforced here rather than in the schema because it depends on `size`, and
     * `FullTourList` deliberately exceeds it: that list bypasses the validator
     * entirely, because "see every date" is the one place a wall of dates is the
     * point.
     */
    maxItemsBySize: { hero: 3, standard: 7, compact: 7, fixed: 7 },
} as const

/**
 * The static layout, with every module's own prop defaults applied.
 *
 * The parse alone is not enough, and getting that wrong was a real bug:
 * `LayoutEntrySchema.props` is an open record, so a module's `propsSchema` never
 * ran on this path and none of its `.default()`s applied. `props.highlight`
 * arrived as `undefined` rather than `null`, slipped a `=== null` guard, and the
 * base page drew a pink outline around whichever row happened to be first —
 * while `badges` defaulted to nothing and the base page showed none.
 *
 * Running the schemas here fixes the class rather than the instance: everything
 * that spreads `FALLBACK_LAYOUT` — `BaseProvider`, `PrecomputedProvider`'s
 * missing-key branch, the path-to-purchase rescue below — gets real props. It
 * throws at import if `fallback-layout.json` is ever wrong, which is the right
 * failure: a broken baseline should stop the build, not degrade quietly.
 */
export const FALLBACK_LAYOUT: LayoutSpec = (() => {
    const parsed = LayoutSpecSchema.parse(fallbackLayoutJson)

    return {
        ...parsed,
        layout: parsed.layout.map((entry) => {
            if (!isModuleId(entry.module)) return entry
            return {
                ...entry,
                props: MODULE_CATALOG[entry.module].propsSchema.parse(entry.props) as Record<
                    string,
                    unknown
                >,
            }
        }),
    }
})()

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
/**
 * Repairs where two props contradict each other, whatever the market says.
 *
 * `heading` and `group_by_geo` are the case that showed up: an explicit heading
 * names the whole section, geo-grouping names each group, and the card's header
 * prints the section heading once per group — so setting both renders the same
 * title twice, above a one-row group and again above a seven-row group. That is
 * a wrong page rather than a weak judgment, so it is impossible here rather than
 * discouraged in the system prompt (docs/COMPOSABILITY.md).
 *
 * The heading wins because it is the more specific intent: the model wrote a
 * line about what this section is, and it means to be read once.
 */
function repairContradictions(moduleId: ModuleId, props: Record<string, unknown>): string[] {
    const repairs: string[] = []

    if (moduleId !== 'production_list') return repairs

    const heading = props.heading
    const named = typeof heading === 'string' && heading.trim() !== ''

    if (named && props.group_by_geo === true) {
        props.group_by_geo = false
        repairs.push(
            'set `group_by_geo: false` (a section with its own `heading` would print that heading above every geo group)',
        )
    }

    return repairs
}

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

/**
 * Take `top_pick_reason` off a spec when it does not meet its bounds, before
 * the whole-spec parse sees it.
 *
 * `LayoutSpecSchema.safeParse` is all-or-nothing, so without this a reason one
 * character too long, or carrying a stray asterisk, falls the *entire page*
 * back to the static layout — a composition that was paid for, discarded over
 * prose. That is exactly what "repair, don't discard" exists to prevent, and a
 * length or format miss is the likeliest way a brand-new required field goes
 * wrong.
 *
 * The tooltip is the only thing lost, and the note says why.
 */
function stripUnusableReason(raw: unknown): { raw: unknown; note: ValidationNote | null } {
    if (raw === null || typeof raw !== 'object' || !('top_pick_reason' in raw)) {
        return { raw, note: null }
    }

    const candidate = (raw as { top_pick_reason?: unknown }).top_pick_reason
    if (candidate === null || candidate === undefined) return { raw, note: null }

    const field = LayoutSpecSchema.shape.top_pick_reason.safeParse(candidate)
    if (field.success) return { raw, note: null }

    return {
        raw: { ...(raw as Record<string, unknown>), top_pick_reason: null },
        note: {
            level: 'repaired',
            reason: `dropped \`top_pick_reason\` (${field.error.issues
                .map((issue) => issue.message)
                .join('; ')}); the chip renders without a tooltip`,
        },
    }
}

export function validateLayout(raw: unknown, market: Market): ValidationResult {
    const notes: ValidationNote[] = []

    const reason = stripUnusableReason(raw)
    if (reason.note) notes.push(reason.note)
    raw = reason.raw

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

    // The visitor's city, checked against the snapshot for the same reason the
    // pick is: it is a claim about the data, and this one gets *printed*. An
    // invented city groups nothing — every date falls into "away" — and the
    // section header names a place the page does not show. Falling back to the
    // context's geo-IP guess is the honest failure; it is at least a city
    // something in the tour is in.
    //
    // Case-insensitive, because "los angeles" and "Los Angeles" are the same
    // claim and the exact-match grouping in `selectProductions` is not. The
    // snapshot's own spelling wins, so the header reads the way the rows do.
    let visitorMetro = spec.visitor_metro
    if (visitorMetro !== null) {
        const match = market.productions.find(
            (production) => production.city.toLowerCase() === visitorMetro!.trim().toLowerCase(),
        )
        if (!match) {
            notes.push({
                level: 'repaired',
                reason: `dropped \`visitor_metro\` (\`${visitorMetro}\` is not a city in this snapshot)`,
            })
            visitorMetro = null
        } else {
            visitorMetro = match.city
        }
    }

    const kept: LayoutSpec['layout'] = []
    const instanceCount = new Map<string, number>()
    const regionCount = new Map<string, number>()
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
        const instances = (instanceCount.get(entry.module) ?? 0) + 1
        if (instances > STRUCTURAL_RULES.maxInstances) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: `placed more than ${STRUCTURAL_RULES.maxInstances} times`,
            })
            continue
        }

        const inRegion = (regionCount.get(definition.region) ?? 0) + 1
        if (definition.region !== 'main' && inRegion > STRUCTURAL_RULES.maxPerSideRegion) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: 'a module is already placed in the right rail',
            })
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

        // Read before `repairProps` applies defaults, so a clamp is only worth
        // reporting when the model actually asked for more than it can have.
        const askedFor = (entry.props as Record<string, unknown>).max_items

        const { props, repairs } = repairProps(entry.module, entry.props)
        if (props === null) {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: `props could not be repaired${repairs.length ? `: ${repairs.join('; ')}` : ''}`,
            })
            continue
        }
        if (props !== null && typeof props.max_items === 'number') {
            const cap = STRUCTURAL_RULES.maxItemsBySize[size]
            if (props.max_items > cap) {
                if (typeof askedFor === 'number') {
                    repairs.push(
                        `capped \`max_items\` at ${cap} (a \`${size}\` section holds ${cap}; ${askedFor} was asked for)`,
                    )
                }
                props.max_items = cap
            }
        }

        repairs.push(...repairContradictions(entry.module, props))
        repairs.push(...repairAgainstMarket(entry.module, props, market))
        for (const repair of repairs) {
            notes.push({ level: 'repaired', module: entry.module, reason: repair })
        }

        if (size === 'hero') heroCount++
        instanceCount.set(entry.module, instances)
        regionCount.set(definition.region, inRegion)
        kept.push({ module: entry.module, size, props })
    }

    // Several lists stacked on one page are unreadable without a line saying
    // what each one is, so a repeated module has to name its sections. This is a
    // post-pass because whether a module repeated is only known once every entry
    // has been seen.
    //
    // An un-headed instance is dropped rather than given a synthesised heading:
    // writing the section's copy is the orchestrator's job, and a validator
    // inventing it would hide the mistake instead of surfacing it. If that
    // leaves a single instance, it falls back to the module's built-in headings,
    // which read correctly again once there is only one list.
    const repeated = new Set(
        [...instanceCount.entries()].filter(([, count]) => count > 1).map(([module]) => module),
    )
    if (repeated.size > 0) {
        for (let index = kept.length - 1; index >= 0; index--) {
            const entry = kept[index]
            if (!repeated.has(entry.module)) continue

            const heading = (entry.props as { heading?: unknown }).heading
            if (typeof heading === 'string' && heading.trim() !== '') continue

            kept.splice(index, 1)
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: 'placed more than once without a `heading` — each section needs its own',
            })

            // Said separately, because losing the recommendation is the more
            // expensive half and the heading note does not imply it. A hero
            // arrived with a pick in its props and no heading, was dropped by
            // the rule above, and the page showed no hero and no
            // recommendation while reporting only a missing heading.
            const orphaned = (entry.props as { top_pick?: unknown }).top_pick
            if (typeof orphaned === 'string' && orphaned.trim() !== '') {
                notes.push({
                    level: 'dropped',
                    module: entry.module,
                    reason: `\`top_pick\` (\`${orphaned}\`) went with it — the section holding the recommendation was dropped`,
                })
            }
        }
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

    // The page's one recommendation, taken off the hero section rather than off
    // the spec.
    //
    // It was page-level, and that let the model name a date its own hero filter
    // would never return: it recommended the fourth highest-demand date while
    // describing it as the strongest of the top three, because it writes the
    // filter and the prose in the same breath and never sees the rows. Authored
    // on the hero, a pick that is not one of the three dates the page
    // recommends has nowhere to live.
    //
    // "One pick per page" survives the move without being enforced here.
    // `maxHero` is 1 and a second hero is demoted above, so by this point only
    // one entry can be carrying a pick — which is why this reads `kept` rather
    // than `spec.layout`.
    let topPick: string | null = null
    let topPickReason: string | null = null
    let reasonDropped = false

    for (const entry of kept) {
        const props = entry.props as { top_pick?: unknown; top_pick_reason?: unknown }
        const candidate = props.top_pick
        const candidateReason = props.top_pick_reason

        // Lifted off props either way. Downstream these are page fields, and
        // leaving them behind would hand `selectProductions` props it does not
        // know and the demo panel two places to look.
        delete props.top_pick
        delete props.top_pick_reason

        if (typeof candidate !== 'string' || candidate.trim() === '') {
            // Kept rather than discarded so the pair check below can say the
            // reason has nothing to explain. Dropping it here would lose the
            // only signal that the model wrote half the recommendation.
            if (typeof candidateReason === 'string') topPickReason = candidateReason
            continue
        }

        if (entry.size !== 'hero') {
            notes.push({
                level: 'dropped',
                module: entry.module,
                reason: `dropped \`top_pick\` (\`${candidate}\`) from a \`${entry.size}\` section; the recommendation belongs to the hero`,
            })
            continue
        }

        topPick = candidate.trim()
        topPickReason = typeof candidateReason === 'string' ? candidateReason : null
    }

    // A page-level pick is the *resolved* shape, not a rejected one, so falling
    // back to it is what keeps this function idempotent.
    //
    // `replay` in `live.ts` re-validates every cached composition on the way
    // out, and its contract is that a spec which already passed comes back
    // unchanged. Lifting the pick out of the hero breaks that on the second
    // pass: the stored spec carries the pick at the top level and its hero
    // props are already stripped, so a rule that dropped a page-level pick
    // deleted the recommendation off every composition ever paid for. It did,
    // for two of them.
    //
    // The consequence of being lenient here is that a fresh reply written
    // against the old shape is accepted silently rather than flagged. That is
    // the right way round: the system prompt is what steers authoring, and the
    // renderer only ever offers the pick to the hero, so a page-level pick
    // still cannot be labelled anywhere else.
    if (topPick === null && spec.top_pick !== null) {
        topPick = spec.top_pick
        topPickReason = spec.top_pick_reason
    }

    if (topPick !== null && !market.productions.some((production) => production.id === topPick)) {
        notes.push({
            level: 'repaired',
            reason: `dropped \`top_pick\` (\`${topPick}\` is not a date in this snapshot)`,
        })
        topPick = null
    }

    // The reason arrives inside an open `props` record, so nothing has checked
    // it against its bounds yet — that used to happen at parse time, when it
    // was a spec field.
    if (topPickReason !== null) {
        const field = LayoutSpecSchema.shape.top_pick_reason.safeParse(topPickReason)
        if (field.success) {
            topPickReason = field.data
        } else {
            notes.push({
                level: 'repaired',
                reason: `dropped \`top_pick_reason\` (${field.error.issues
                    .map((issue) => issue.message)
                    .join('; ')})`,
            })
            topPickReason = null
            reasonDropped = true
        }
    }

    // The pick and its reason are checked as a pair, because neither field can
    // see the other on its own.
    //
    // A reason with no pick is orphaned prose and goes. A pick with no usable
    // reason keeps the pick: the recommendation is the valuable half and it is
    // still sound, so losing it over missing prose would throw away the model's
    // actual judgment. The chip renders with no tooltip, and the note is what
    // says so — a required output that quietly went missing is the kind of thing
    // that has to be visible in the panel rather than inferred from a card that
    // does nothing on hover.
    if (topPickReason !== null && topPick === null) {
        notes.push({
            level: 'repaired',
            reason: 'dropped `top_pick_reason` (there is no `top_pick` for it to explain)',
        })
        topPickReason = null
    } else if (
        topPick !== null &&
        topPickReason === null &&
        !reasonDropped &&
        reason.note === null
    ) {
        notes.push({
            level: 'repaired',
            reason: `\`top_pick\` (\`${topPick}\`) arrived without a \`top_pick_reason\`; the chip renders without a tooltip`,
        })
    }

    return {
        spec: {
            layout: kept,
            reasoning: spec.reasoning,
            headline: spec.headline,
            top_pick: topPick,
            visitor_metro: visitorMetro,
            top_pick_reason: topPickReason,
        },
        notes,
        usedFallback: false,
    }
}
