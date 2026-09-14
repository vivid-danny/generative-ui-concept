import { describe, expect, it } from 'vitest'

import { lastCall, recentBriefs, type CallRecord } from './ledger'

/**
 * The read/write halves are thin `fs` wrappers that swallow their own errors,
 * and a test that appends to `.cache/calls.log` would be writing to a record of
 * real money. So only the pure readers are tested here.
 *
 * `recentBriefs` is the one with something to get wrong. It exists because a
 * typed brief lives in the URL and nowhere else, and it has two ordering traps
 * and one correctness trap that would each cost a call.
 */

let counter = 0

const record = (over: Partial<CallRecord> = {}): CallRecord => {
    counter += 1
    return {
        // Ascending, so a list built in call order is also in time order.
        at: new Date(Date.UTC(2026, 0, 1, 0, counter)).toISOString(),
        mode: 'custom',
        key: `key-${counter}`,
        trigger: 'run button',
        outcome: 'composed',
        durationMs: 60_000,
        costUsd: 0.15,
        inputTokens: 18_000,
        ...over,
    }
}

describe('recentBriefs', () => {
    it('is empty with no records', () => {
        expect(recentBriefs([])).toEqual([])
    })

    it('returns most recent first, though the ledger is oldest first', () => {
        const briefs = recentBriefs([
            record({ brief: 'first' }),
            record({ brief: 'second' }),
            record({ brief: 'third' }),
        ])

        expect(briefs).toEqual(['third', 'second', 'first'])
    })

    it('ranks a repeated brief by its most recent run, not its first', () => {
        // The trap: deduping before reversing keeps each brief at the position
        // it had the first time it was ever run, so a brief re-run seconds ago
        // sorts below one from last week.
        const briefs = recentBriefs([
            record({ brief: 'old favourite' }),
            record({ brief: 'something else' }),
            record({ brief: 'old favourite' }),
        ])

        expect(briefs).toEqual(['old favourite', 'something else'])
    })

    it('excludes eval, because an eval brief replayed as custom is never cached', () => {
        // `mode` is part of the cache key material, so `?mode=custom` with the
        // eval brief hashes to a key nothing was written under. Offering it back
        // would read as "already run" and then cost a call.
        const briefs = recentBriefs([
            record({ mode: 'eval', brief: "She's in Chicago and can spend about $80 a ticket." }),
            record({ mode: 'custom', brief: 'a typed one' }),
        ])

        expect(briefs).toEqual(['a typed one'])
    })

    it('keeps briefs from calls that failed', () => {
        // The whole point of recording the brief on the failure path: a call
        // killed at the 180s timeout spent the tokens and left no composition,
        // so this line is the only surviving copy of what was asked for.
        const briefs = recentBriefs([
            record({ brief: 'died at the timeout', outcome: 'failed', costUsd: null }),
        ])

        expect(briefs).toEqual(['died at the timeout'])
    })

    it('ignores lines written before the field existed, and blank ones', () => {
        // `readLedger` casts rather than validates, so an older line simply has
        // no `brief` key at all.
        const briefs = recentBriefs([
            record(),
            record({ brief: null }),
            record({ brief: '   ' }),
            record({ brief: 'the only real one' }),
        ])

        expect(briefs).toEqual(['the only real one'])
    })

    it('caps the list at five', () => {
        const briefs = recentBriefs(
            Array.from({ length: 9 }, (_, index) => record({ brief: `brief ${index}` })),
        )

        expect(briefs).toEqual(['brief 8', 'brief 7', 'brief 6', 'brief 5', 'brief 4'])
    })
})

describe('lastCall', () => {
    it('is null with no records', () => {
        expect(lastCall([])).toBeNull()
    })

    it('is the newest, which is the last line', () => {
        const newest = record({ brief: 'newest' })
        expect(lastCall([record({ brief: 'older' }), newest])).toBe(newest)
    })
})
