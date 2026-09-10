import type { Production } from '@/contracts/market'

/**
 * The per-row signal in the slot beside the CTA.
 *
 * That slot was left empty on purpose when the price moved into the button —
 * "what earns it" was a decision of its own. This is the first answer: which
 * way a date's price has moved over the last week, off the existing
 * `price_trend_7d`.
 *
 * Two things make it a signal rather than a badge. It is chosen once per
 * section, so every row in a section shows one or none — rows that differ
 * inside a list is what destroys the comparability the list exists for. And it
 * renders on flat dates too, reading "Steady", because an indicator that
 * vanishes on some rows makes a section look inconsistent rather than
 * informative. A badge earns its place by being true of a few rows; this earns
 * its place by being the same fact on every row.
 *
 * Enumerated rather than a boolean, so the slot can later hold a different
 * signal without renaming the prop or invalidating a composition.
 */

export const CARD_SIGNALS = ['price_trend'] as const
export type CardSignal = (typeof CARD_SIGNALS)[number]

export type TrendDirection = 'down' | 'up' | 'flat'

export interface CardSignalValue {
    direction: TrendDirection
    /** Pre-written. Ours, not the model's. */
    label: string
}

/**
 * Below this a week's movement is noise, and quoting "1%" on it implies a
 * precision the fabricated trend does not have.
 */
const FLAT_BAND = 0.01

export function priceTrendFor(production: Production): CardSignalValue {
    const change = production.price_trend_7d

    if (Math.abs(change) < FLAT_BAND) return { direction: 'flat', label: 'Steady' }

    const percent = Math.round(Math.abs(change) * 100)

    return change < 0
        ? { direction: 'down', label: `↓ ${percent}% this week` }
        : { direction: 'up', label: `↑ ${percent}% this week` }
}

/** What this section shows in the slot, if anything. */
export function cardSignalFor(
    production: Production,
    signal: CardSignal | null,
): CardSignalValue | null {
    return signal === 'price_trend' ? priceTrendFor(production) : null
}
