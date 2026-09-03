import { describe, expect, it } from 'vitest'

import { daysOut, isWeekend, isWeeknight } from './derive'

/**
 * The one thing worth guarding here is the timezone landmine: these must read the
 * venue-local wall-clock day, not a UTC-shifted one, or "weekend" and "days out"
 * quietly disagree with the date the card renders.
 */

describe('isWeekend / isWeeknight', () => {
    it('treats Friday, Saturday and Sunday as the weekend', () => {
        expect(isWeekend('2026-12-04T19:30:00')).toBe(true) // Fri
        expect(isWeekend('2026-12-05T19:30:00')).toBe(true) // Sat
        expect(isWeekend('2026-12-06T18:00:00')).toBe(true) // Sun
    })

    it('treats Monday through Thursday as weeknights', () => {
        expect(isWeeknight('2026-12-07T19:30:00')).toBe(true) // Mon
        expect(isWeeknight('2026-12-08T19:30:00')).toBe(true) // Tue
        expect(isWeeknight('2026-12-09T19:30:00')).toBe(true) // Wed
        expect(isWeeknight('2026-12-10T19:30:00')).toBe(true) // Thu
    })

    it('is the exact complement of isWeekend', () => {
        for (const d of ['2026-12-04', '2026-12-07', '2026-12-05', '2026-12-10']) {
            expect(isWeeknight(`${d}T19:30:00`)).toBe(!isWeekend(`${d}T19:30:00`))
        }
    })

    it('reads the local weekday even for a late-evening show, not a UTC-shifted one', () => {
        // A 19:30 local show on Saturday must not roll over to Sunday via UTC.
        expect(isWeekend('2026-12-05T19:30:00')).toBe(true)
    })
})

describe('daysOut', () => {
    it('matches the pinned anchor: the Chicago second night is 94 days out', () => {
        expect(daysOut('2026-12-05T19:30:00', '2026-09-02')).toBe(94)
    })

    it('ignores the time component — same calendar day is zero days out', () => {
        expect(daysOut('2026-09-02T20:00:00', '2026-09-02')).toBe(0)
    })

    it('returns a negative number for a past event', () => {
        expect(daysOut('2026-08-30T19:30:00', '2026-09-02')).toBeLessThan(0)
    })
})
