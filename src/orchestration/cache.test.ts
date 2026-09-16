import { describe, expect, it } from 'vitest'

import { cacheKey } from './cache'

/**
 * Only the key is tested here — the read/write halves are thin `fs` wrappers
 * that swallow their own errors, and a test that writes to disk would be worse
 * than no test.
 *
 * The key is where a mistake actually hurts, and it has already been wrong once:
 * an earlier version enumerated a few fields (brief, prompt version, snapshot
 * date) and quietly went stale, replaying a composition made before the fixture
 * gained fields and the catalog gained a prop. Hashing the real message is what
 * fixed it, so most of these assert that the parts of the message people
 * actually edit each change the key.
 */

const base = {
    mode: 'eval',
    message: 'Compose the page.\n\nbrief: she is in Chicago with about $80',
    promptText: '# Orchestrator prompt — v3\n\nCompose a page.',
}

describe('cacheKey', () => {
    it('is stable for identical inputs', () => {
        expect(cacheKey(base)).toBe(cacheKey({ ...base }))
    })

    it('changes with the mode', () => {
        expect(cacheKey({ ...base, mode: 'custom' })).not.toBe(cacheKey(base))
    })

    it('changes when anything in the message changes', () => {
        // The message carries the brief, the context, the market snapshot and
        // the whole module catalog, so this one assertion covers all of them.
        expect(cacheKey({ ...base, message: `${base.message} and prefers Saturdays` })).not.toBe(
            cacheKey(base),
        )
    })

    it('changes when the prompt is edited without its version being bumped', () => {
        // The failure the previous key had: keying on "v3" meant an edited
        // prompt kept serving compositions made under the old instructions.
        const edited = base.promptText.replace(
            'Compose a page.',
            'Compose a page. Prefer weekends.',
        )

        expect(edited).not.toBe(base.promptText)
        expect(cacheKey({ ...base, promptText: edited })).not.toBe(cacheKey(base))
    })

    it('treats an unreadable prompt as its own case', () => {
        expect(cacheKey({ ...base, promptText: null })).not.toBe(cacheKey(base))
    })

    it('does not collide when a value contains the separator', () => {
        // The message is prose, so a plain join would let ("a b", "c") and
        // ("a", "b c") flatten to the same material.
        const a = cacheKey({ ...base, mode: 'a b', message: 'c' })
        const b = cacheKey({ ...base, mode: 'a', message: 'b c' })

        expect(a).not.toBe(b)
    })
})
