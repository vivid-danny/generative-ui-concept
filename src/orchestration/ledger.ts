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

export async function recordCall(record: CallRecord): Promise<void> {
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

/** What has been spent, for the drawer. Timeouts are included — they were paid for. */
export function ledgerTotals(records: CallRecord[]): {
    calls: number
    costUsd: number
    failures: number
} {
    return {
        calls: records.length,
        costUsd: records.reduce((total, record) => total + (record.costUsd ?? 0), 0),
        failures: records.filter((record) => record.outcome !== 'composed').length,
    }
}
