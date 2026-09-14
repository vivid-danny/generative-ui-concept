import type { Production } from '@/contracts/market'

/**
 * The slot beside each row's CTA, and what a section may put in it.
 *
 * **The slot's purpose is to contextualise the get-in price.** That number in
 * the button — "From $76" — is one listing, often the worst seat in the
 * building, and on its own it is close to meaningless: it does not say whether
 * $76 is cheap for this tour, cheap compared to the other dates on the page, or
 * anything about what a seat someone would actually want costs. Each signal here
 * supplies a different reference point for that one number:
 *
 * - `price_trend` — the same date last week.
 * - `price_gap_to_cheapest` — the other dates this section is showing.
 * - `typical_seat_price` — the rest of the listings on this same date.
 *
 * Which reference a visitor needs is a real editorial decision, and it is the
 * decision the orchestrator makes by naming one. Enumerated, not free text: each
 * of these makes a claim about money, so the wording is ours.
 *
 * Two things make this a signal rather than a badge. It is chosen once per
 * section, so it renders on **every** row in that section including the
 * uninteresting ones — a badge fires only where it is true and so makes rows
 * differ, while this makes rows comparable, which is the whole job of a list.
 * And every signal therefore needs a defined resting form: `Steady`, or the
 * cheapest row's own label, never a blank.
 */

export const CARD_SIGNAL_IDS = [
    'price_trend',
    'price_gap_to_cheapest',
    'typical_seat_price',
] as const

export type CardSignal = (typeof CARD_SIGNAL_IDS)[number]

/**
 * How the card colours a signal.
 *
 * Replaced a `direction: 'down' | 'up' | 'flat'` field, which was a property of
 * `price_trend` that got promoted into the shared type because it was the only
 * signal there. Most of these are not directional — "Typical seat ~$210" is not
 * up or down — so the shared shape carries the one thing every signal has: is
 * this good news for the buyer, bad news, or just information.
 *
 * `adverse` was added on 2026-09-14, reversing an earlier call recorded below.
 */
export type SignalTone = 'good' | 'neutral' | 'adverse'

export interface CardSignalValue {
    tone: SignalTone
    /** Pre-written. Ours, not the model's. */
    label: string
}

interface CardSignalDefinition {
    id: CardSignal
    /**
     * `set` is the rows this section is rendering, after filtering, exclusions
     * and `max_items`. A signal that compares within the page compares within
     * the section, which is why two sections can each have their own cheapest.
     */
    resolve: (production: Production, set: readonly Production[]) => CardSignalValue
}

/**
 * Below this a week's movement is noise, and quoting "1%" on it implies a
 * precision the fabricated trend does not have.
 */
const FLAT_BAND = 0.01

/** Seat prices are quoted to the nearest $5 — the median is an estimate, not a price. */
const SEAT_PRICE_STEP = 5

export const CARD_SIGNALS: Record<CardSignal, CardSignalDefinition> = {
    price_trend: {
        id: 'price_trend',
        resolve: (production) => {
            const change = production.price_trend_7d

            if (Math.abs(change) < FLAT_BAND) return { tone: 'neutral', label: 'Steady' }

            const percent = Math.round(Math.abs(change) * 100)

            // Both directions are coloured, which reverses an earlier call.
            // The old reasoning was that red on "prices rose" is pressure
            // dressed as information — true of a manufactured number, but this
            // one is a real week-over-week move on the date in the row, and a
            // buyer deciding *when* to commit is exactly who needs it. Leaving
            // a rise in grey while a fall gets colour states a preference about
            // which way the news should go, which is its own distortion.
            //
            // It stays honest because `FLAT_BAND` already refuses to colour
            // noise: a 1% wobble reads "Steady" in neutral, so red only appears
            // where the move is real.
            return change < 0
                ? { tone: 'good', label: `↓ ${percent}% this week` }
                : { tone: 'adverse', label: `↑ ${percent}% this week` }
        },
    },

    price_gap_to_cheapest: {
        id: 'price_gap_to_cheapest',
        resolve: (production, set) => {
            const cheapest = Math.min(...set.map((row) => row.floor_price))
            const gap = production.floor_price - cheapest

            // The resting form is itself a recommendation, which is why this
            // signal is the strongest of the three: the row where the
            // comparison is least interesting is the row worth telling someone
            // about. It also earns its place most when the section is *not*
            // sorted by price — a demand-sorted column of near-identical
            // buttons is exactly where "what does the good night cost me"
            // is unanswerable without it.
            return gap === 0
                ? { tone: 'good', label: 'Cheapest of these' }
                : { tone: 'neutral', label: `$${gap} over cheapest` }
        },
    },

    typical_seat_price: {
        id: 'typical_seat_price',
        resolve: (production) => {
            const typical = Math.round(production.median_price / SEAT_PRICE_STEP) * SEAT_PRICE_STEP

            // "Typical seat", not "most seats": the median has half the
            // listings below it, and "most" would overstate that. The reference
            // point here is the button on the same row rather than the other
            // rows — the pair reads as a spread, and the spread is the point.
            return { tone: 'neutral', label: `Typical seat ~$${typical.toLocaleString('en-US')}` }
        },
    },
}

/** What this section shows in the slot for this row, if anything. */
export function cardSignalFor(
    production: Production,
    signal: CardSignal | null | undefined,
    set: readonly Production[],
): CardSignalValue | null {
    if (!signal) return null

    return CARD_SIGNALS[signal]?.resolve(production, set) ?? null
}
