import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * The local bridge to the model — source plan Stage 3.
 *
 * Spawns the Claude Code CLI, which is already authenticated with a
 * subscription on this machine. No API key is available (enterprise plan, no API
 * dashboard), so this is the route. It is laptop-only by design and cannot be
 * hosted, which is an accepted constraint rather than a gap.
 *
 * **Server-only.** Never import this from a component — it spawns a child
 * process. `LiveProvider` calls it directly from `getServerSideProps`; the
 * `pages/api/orchestrate` route wraps it for manual poking with curl.
 *
 * The system prompt is read from `orchestrator/prompt.md` rather than embedded
 * here, so the versioned prompt stays the single source of truth and provenance
 * can report the version that actually ran.
 */

/** Overridable so a failure path can be exercised against a missing binary. */
const CLI = process.env.ORCHESTRATOR_CLI ?? 'claude'
const MODEL = process.env.ORCHESTRATOR_MODEL ?? 'claude-sonnet-5'

/**
 * Generous on purpose: timing out a call that would have succeeded is worse than
 * a slow page in a demo nobody else is waiting on — and it still costs whatever
 * the model had already spent.
 *
 * Raised from 60s after a run died at the ceiling. Measured composition calls
 * have crept from ~10s to ~40s as the catalog and the market snapshot have
 * grown, so the headroom was thinner than it looked.
 */
const TIMEOUT_MS = 180_000

const PROMPT_PATH = path.join(process.cwd(), 'orchestrator', 'prompt.md')

export interface BridgeResult {
    /** The model's reply text, unparsed. */
    result: string
    model: string
    /** Parsed from the prompt file's heading, e.g. "v3". */
    promptVersion: string | null
    costUsd: number | null
    durationMs: number
    /** Total input tokens billed (fresh + cache write + cache read). */
    inputTokens: number | null
}

/** The subset of the CLI's `--output-format json` envelope we rely on. */
interface CliEnvelope {
    type?: unknown
    result?: unknown
    total_cost_usd?: unknown
    is_error?: unknown
    usage?: {
        input_tokens?: unknown
        cache_creation_input_tokens?: unknown
        cache_read_input_tokens?: unknown
    }
}

/**
 * `--restricted` makes the CLI emit an array of events rather than a single
 * object, so both shapes have to be handled. The entry we want is the one
 * carrying the final result.
 */
function resultEntry(parsed: unknown): CliEnvelope | null {
    if (Array.isArray(parsed)) {
        const entries = parsed.filter(
            (entry): entry is CliEnvelope => entry !== null && typeof entry === 'object',
        )
        return (
            entries.find((entry) => entry.type === 'result') ??
            entries.reverse().find((entry) => typeof entry.result === 'string') ??
            null
        )
    }
    return parsed !== null && typeof parsed === 'object' ? (parsed as CliEnvelope) : null
}

/** Everything billed as input: fresh tokens plus cache writes and reads. */
function totalInputTokens(usage: CliEnvelope['usage']): number | null {
    if (!usage) return null
    const parts = [
        usage.input_tokens,
        usage.cache_creation_input_tokens,
        usage.cache_read_input_tokens,
    ].map((value) => (typeof value === 'number' ? value : 0))
    const total = parts.reduce((sum, value) => sum + value, 0)
    return total > 0 ? total : null
}

/**
 * Reads the version out of `# Orchestrator prompt — v3` so provenance records
 * the prompt that actually ran, rather than a constant that can drift from the
 * file.
 */
/** The system prompt verbatim, for cache keying. Null if unreadable. */
export async function readPromptText(): Promise<string | null> {
    try {
        return await readFile(PROMPT_PATH, 'utf8')
    } catch {
        return null
    }
}

export async function readPromptVersion(): Promise<string | null> {
    try {
        const text = await readFile(PROMPT_PATH, 'utf8')
        return /^#\s*Orchestrator prompt\s*[—-]\s*(v\d+)/m.exec(text)?.[1] ?? null
    } catch {
        return null
    }
}

export async function callModel(message: string): Promise<BridgeResult> {
    const promptVersion = await readPromptVersion()

    return new Promise<BridgeResult>((resolve, reject) => {
        const startedAt = Date.now()

        const child = spawn(
            CLI,
            [
                '-p',
                '--system-prompt-file',
                PROMPT_PATH,
                '--model',
                MODEL,
                '--output-format',
                'json',
                // The orchestrator emits JSON; it takes no actions. Without
                // these, every call also carried Claude Code's tool definitions
                // and every configured MCP server's schemas — measured at 53k
                // input tokens per composition versus 5.3k with them, a ~20x
                // cost difference. Nothing is given up: the permission gates
                // and sandboxing they remove exist to govern tool use, and
                // there are no tools here. The guardrail that matters is
                // `validateLayout`, which is downstream of the model.
                '--tools',
                '',
                '--restricted',
                '--strict-mcp-config',
                // Composing a page is picking a few modules from a list and
                // filling in props — not hard reasoning. The default was
                // whatever the CLI chooses, and a run took 105s; naming a level
                // at least makes it a decision rather than an inheritance.
                '--effort',
                'medium',
            ],
            { stdio: ['pipe', 'pipe', 'pipe'] },
        )

        let stdout = ''
        let stderr = ''
        let settled = false

        const finish = (fn: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fn()
        }

        const timer = setTimeout(() => {
            finish(() => {
                child.kill('SIGKILL')
                reject(new Error(`the model did not respond within ${TIMEOUT_MS / 1000}s`))
            })
        }, TIMEOUT_MS)

        child.stdout.on('data', (chunk) => (stdout += chunk))
        child.stderr.on('data', (chunk) => (stderr += chunk))

        child.on('error', (error) =>
            finish(() =>
                reject(
                    new Error(
                        `could not run \`${CLI}\` (${error.message}). Is Claude Code installed and logged in?`,
                    ),
                ),
            ),
        )

        child.on('close', (code) => {
            finish(() => {
                if (code !== 0) {
                    reject(new Error(`\`${CLI}\` exited ${code}: ${stderr.trim().slice(0, 300)}`))
                    return
                }

                let envelope: CliEnvelope | null
                try {
                    envelope = resultEntry(JSON.parse(stdout))
                } catch {
                    reject(new Error('the CLI returned output that was not JSON'))
                    return
                }
                if (envelope === null) {
                    reject(new Error('the CLI returned JSON with no result entry'))
                    return
                }
                if (envelope.is_error) {
                    reject(new Error(`the CLI reported an error: ${String(envelope.result).slice(0, 300)}`))
                    return
                }
                if (typeof envelope.result !== 'string' || envelope.result.trim() === '') {
                    reject(new Error('the CLI returned no result text'))
                    return
                }

                resolve({
                    result: envelope.result,
                    model: MODEL,
                    promptVersion,
                    costUsd:
                        typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : null,
                    durationMs: Date.now() - startedAt,
                    inputTokens: totalInputTokens(envelope.usage),
                })
            })
        })

        // The market snapshot is tens of kilobytes, so the message goes over
        // stdin rather than argv. Well within limits today, but argv length is
        // not something to discover the hard way as the fixture grows.
        child.stdin.write(message)
        child.stdin.end()
    })
}
