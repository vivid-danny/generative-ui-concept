import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ResolvedLayout } from '@/contracts/layout-spec'

/**
 * On-disk cache of live compositions.
 *
 * A live call is ~8 seconds and ~8 cents, and the page re-composes on every
 * request — so reloading to check a style tweak used to cost money. Caching
 * makes a composition something you can sit with and study, which is most of
 * what the Eval mode is for.
 *
 * **Server-only** (uses `node:fs`), and deliberately not in git: these are
 * generated artefacts, not source. The committed spec library in `./specs` is
 * the curated set.
 *
 * The key includes the prompt version and the snapshot date, so editing
 * `orchestrator/prompt.md` or the fixture invalidates every entry without
 * anyone having to remember to clear it. That is the behaviour you want while
 * iterating on a prompt — a stale composition attributed to a prompt that no
 * longer exists would be worse than no cache at all.
 */

const CACHE_DIR = path.join(process.cwd(), '.cache', 'compositions')

export interface CacheKeyParts {
    /** Names the bucket, and shows up in the panel. */
    mode: string
    /**
     * The exact user message that would be sent. Hashing what actually goes to
     * the model is what makes the cache honest: it covers the brief, the
     * context, the market snapshot, the module catalog and every `propsHint` in
     * one value, so editing any of them produces a different key.
     *
     * An earlier version enumerated a few fields — brief, prompt version,
     * snapshot date — and quietly went stale. Adding fields to the fixture and a
     * new prop to the catalog changed neither, so a composition made before
     * either existed was replayed as if current.
     */
    message: string
    /**
     * The system prompt's full text, not its version number. A prompt edited
     * without bumping its heading would otherwise keep serving compositions
     * made under the old instructions.
     */
    promptText: string | null
}

export function cacheKey(parts: CacheKeyParts): string {
    // JSON rather than a joined string: the message is prose, so any plain
    // separator appears inside a value and two different key sets could flatten
    // to the same material.
    const material = JSON.stringify([parts.mode, parts.message, parts.promptText])

    return createHash('sha256').update(material).digest('hex').slice(0, 16)
}

export async function readCached(key: string): Promise<ResolvedLayout | null> {
    try {
        const raw = await readFile(path.join(CACHE_DIR, `${key}.json`), 'utf8')
        return JSON.parse(raw) as ResolvedLayout
    } catch {
        // A miss and an unreadable file are the same thing to the caller: call
        // the model. Never let a cache problem take the page down.
        return null
    }
}

export async function writeCached(key: string, layout: ResolvedLayout): Promise<void> {
    try {
        await mkdir(CACHE_DIR, { recursive: true })
        await writeFile(
            path.join(CACHE_DIR, `${key}.json`),
            JSON.stringify(layout, null, 2),
            'utf8',
        )
    } catch {
        // Failing to cache is not worth failing a composition over.
    }
}
