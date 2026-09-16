# AGENTS.md

Rules for working in this repo. [`README.md`](README.md) is what the project is,
how to run it, and what a call costs — read it first; this file does not repeat
it.

## Spending money

A live composition costs real money and time, billed to whoever's `claude` CLI
is signed in. There is no shared budget. See
[What a call costs](README.md#what-a-call-costs-and-how-to-not-spend-it-twice)
for the figures and the caching rules.

- **One live call per change, and `?mode=eval` only.** Not `custom` — a scripted
  brief is reproducible and a typed one is not.
- **`/harness` is how you check visuals.** It renders every implemented module
  from fixture props and costs nothing. Use it after any component or token edit;
  do not re-compose a page to look at a card.
- **Never raise `TIMEOUT_MS` to stop it firing.** It firing is the signal that
  the system prompt or the catalog has grown.
- **Editing the system prompt or the module catalog invalidates every cached
  composition.** Screenshot anything worth keeping first.

## Git

**Never commit, branch, push or open a PR unless the repo owner asks.** Finish
the work and leave it in the working tree. This is not a habit to fall into at
the end of a task — it is an action the owner takes.

## The seams

Duplicated from the README on purpose: you need these before you have read it.

- **`src/contracts/`** is the source of truth — four Zod schemas. A change here
  changes what the model is sent.
- **`orchestrator/prompt.md`** is passed to the model *whole* on every call, so
  every word is billed every time. Version history goes in
  [`docs/PROMPT-HISTORY.md`](docs/PROMPT-HISTORY.md), never in the prompt. Bump
  the `# Orchestrator prompt — vN` heading when you edit it; provenance parses it.
- **`src/shell/`** is chrome the model cannot compose away. It does not go
  through the layout spec.
- **`src/renderer/ComposedPage.tsx`** is deliberately dumb: it mounts what the
  validated spec says and makes no decisions.

Where a new rule belongs is answered in
[`docs/COMPOSABILITY.md`](docs/COMPOSABILITY.md): if the page would be *wrong*
when the rule is broken, enforce it in code; if it is a judgment about what
serves this visitor, put it in the system prompt. A rule the model can reason its
way around is not a rule.

## Tests

`vitest.config.ts` sets `environment: 'node'` and includes `src/**/*.test.ts`
only, so the decision logic is covered and **every `.tsx` file is untested by
design**. Component fidelity is checked by eye in `/harness`, not by assertion.
`src/orchestration/bridge.ts` is also untested — it spawns a subprocess.

## Style

Single quotes, no semicolons, 4-space indent, ~100 columns. `npm run format`
enforces it, scoped to `ts/tsx/scss/css`. Markdown is hand-wrapped — leave it
out. Generated token files under `src/design/tokens/` are regenerated, never
hand-edited.

## Honesty

Never fabricate a number, a file path, a test result, or a verification you did
not run. Re-derive a figure before asserting it, and say plainly what you could
not check. "I cannot tell from this" is an acceptable answer; an invented one is
not.

**Fixture data is partly fabricated** — `src/fixtures/README.md` marks which
fields are real. Never state a fixture number as fact.
