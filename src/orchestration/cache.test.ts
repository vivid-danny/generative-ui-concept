import { describe, expect, it } from 'vitest'

import { cacheKey } from './cache'

/**
 * Only the key is tested here — the read/write halves are thin `fs` wrappers
 * that swallow their own errors, and a test that writes to disk would be worse
 * than no test.
 *
 * The key is where a mistake would actually hurt: too loose and you serve a
 * composition made under a prompt that no longer exists, too tight and the
 * cache never hits and every reload costs money.
 */

const base = {
    mode: 'eval',
    brief: 'she is in Chicago with about $80',
    contextId: 'base',
    promptVersion: 'v3',
    marketCapturedAt: '2026-09-02',
}

describe('cacheKey', () => {
    it('is stable for identical inputs', () => {
        expect(cacheKey(base)).toBe(cacheKey({ ...base }))
    })

    it('changes when the brief changes', () => {
        expect(cacheKey({ ...base, brief: 'something else' })).not.toBe(cacheKey(base))
    })

    it('changes when the prompt version changes', () => {
        // The reason this is in the key: a composition attributed to a prompt
        // that has since been edited is misleading in the panel.
        expect(cacheKey({ ...base, promptVersion: 'v4' })).not.toBe(cacheKey(base))
    })

    it('changes when the snapshot is re-captured', () => {
        expect(cacheKey({ ...base, marketCapturedAt: '2026-10-01' })).not.toBe(cacheKey(base))
    })

    it('changes with the mode', () => {
        expect(cacheKey({ ...base, mode: 'custom' })).not.toBe(cacheKey(base))
    })

    it('treats a null brief as distinct from an empty one', () => {
        expect(cacheKey({ ...base, brief: null })).not.toBe(cacheKey({ ...base, brief: ' ' }))
    })

    it('does not collide when a value contains the separator', () => {
        // The adversarial case for a space-joined key: ("a b", "c") and
        // ("a", "b c") both flatten to "a b c".
        const a = cacheKey({ ...base, mode: 'a b', contextId: 'c' })
        const b = cacheKey({ ...base, mode: 'a', contextId: 'b c' })
        expect(a).not.toBe(b)
    })
})
