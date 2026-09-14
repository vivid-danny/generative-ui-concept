import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * An append-only record of every live call.
 *
 * Three calls were fired inside seven minutes without anyone intending to, and
 * the only trace was a dev-server access log — the drawer reports a cost per
 * *composition*, so a call that timed out or was replaced left nothing behind at
 * all. Spending is not auditable from the UI, which is how "one eval call" turned
 * into five over a morning.
 *
 * So: one line per call attempt, written whatever the outcome, including the
 * ones that fail. A timeout costs real money and is the most important kind to
 * see, because it leaves no composition to inspect.
 *
 * **Server-only** (uses `node:fs`) and gitignored alongside the compositions —
 * it is a record of this machine's spending, not source.
 */

const LEDGER_PATH = path.join(process.cwd(), '.cache', 'calls.log')

export type CallOutcome = 'composed' | 'unparseable' | 'failed'

export interface CallRecord {
    at: string
    /** Which mode asked for it — `eval`, `custom`. */
    mode: string
    /** The composition cache key, so a line can be tied to its artefact. */
    key: string
    /**
     * The brief this call was composed from.
     *
     * Optional because every line written before this field existed will not
     * have it, and `readLedger` casts rather than validates — a required field
     * would be a type that lies about what is on disk. Read it as
     * `record.brief ?? null`.
     *
     * This is the only durable copy of a typed brief. The composition artefact
     * does not carry one (`SpecProvenance` keys on persona and budget, see
     * `context-key.ts`), and the drawer holds the text in React state only
     * until a call succeeds. So for a call that failed or timed out, this line
     * is the whole record of what was asked for.
     */
    brief?: string | null
    /**
     * What caused the call. Only ever a deliberate press now, but recorded
     * rather than assumed: if an automatic trigger ever comes back, the ledger
     * is where it will show up.
     */
    trigger: string
    outcome: CallOutcome
    durationMs: number | null
    costUsd: number | null
    inputTokens: number | null
    /** Present when the outcome is not `composed`. */
    error?: string
}

/**
 * A test run must never write here.
 *
 * It already happened: six entries landed from one `npm test` before the
 * provider tests mocked this module, each carrying the mock's fixed $0.500, and
 * the drawer then reported $2.177 spent when $0.177 was real. A ledger that can
 * be poisoned by a test is worse than no ledger — it is a number you cannot
 * trust but will read anyway.
 *
 * Mocking the module is still right in the tests that assert on it; this is the
 * backstop for the ones that do not think about it.
 */
const isTestRun = () => process.env.VITEST !== undefined || process.env.NODE_ENV === 'test'

export async function recordCall(record: CallRecord): Promise<void> {
    if (isTestRun()) return

    try {
        await mkdir(path.dirname(LEDGER_PATH), { recursive: true })
        await appendFile(LEDGER_PATH, `${JSON.stringify(record)}\n`, 'utf8')
    } catch {
        // Failing to write the ledger must never fail a composition that worked.
    }
}

/** Every call so far, oldest first. Unparseable lines are skipped, not thrown. */
export async function readLedger(): Promise<CallRecord[]> {
    try {
        const raw = await readFile(LEDGER_PATH, 'utf8')
        return raw
            .split('\n')
            .filter((line) => line.trim() !== '')
            .flatMap((line) => {
                try {
                    return [JSON.parse(line) as CallRecord]
                } catch {
                    return []
                }
            })
    } catch {
        return []
    }
}

/**
 * The most recent attempt, for the drawer.
 *
 * A running total replaced this and was the wrong number to put on screen: "3
 * calls · $0.52 · 1 failed" asks the reader to work out what it means, and the
 * question in front of someone who has just pressed Run is what *that* press
 * cost. The total is still reconstructable from the log, which is where a
 * question about cumulative spend belongs.
 */
export function lastCall(records: CallRecord[]): CallRecord | null {
    return records.length === 0 ? null : records[records.length - 1]
}

/** How many briefs the drawer offers back. Five ranked beats ten unranked. */
const BRIEF_HISTORY_LIMIT = 5

/**
 * The briefs typed into the Custom tab, most recent first.
 *
 * A scripted eval brief lives in a fixture, so it never needed remembering. A
 * typed one exists nowhere but the URL of the tab it was typed in — close that
 * tab and the composition you paid for is unreachable, sitting in `.cache`
 * under a 16-character hash. This is what makes it findable again.
 *
 * Custom only, and deliberately: `mode` is part of the cache key material
 * (`cache.ts`), so an eval brief offered back as `?mode=custom&brief=…` hashes
 * to a key nothing was ever written under. It would read as "already run" and
 * then cost a call.
 */
export function recentBriefs(records: CallRecord[]): string[] {
    const seen = new Set<string>()

    // Reversed before deduping, not after. The ledger is oldest-first, so
    // keeping the first occurrence of a repeated brief in that order would pin
    // it at the position it had the first time it was ever run — a brief from
    // five minutes ago would sort below one from last week.
    for (const record of [...records].reverse()) {
        if (record.mode !== 'custom') continue
        const brief = record.brief?.trim()
        if (!brief) continue
        seen.add(brief)
        if (seen.size === BRIEF_HISTORY_LIMIT) break
    }

    return [...seen]
}
