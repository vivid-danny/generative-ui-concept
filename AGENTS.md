# AGENTS.md

Conventions for working in this repo. [`README.md`](README.md) is how to get it
running; this file is what to know before you change anything.

## What this is

A Vivid Seats performer page whose layout is decided by an LLM at request time
rather than designed once for everyone. The model receives a market snapshot and
a visitor context and returns a validated layout spec — which modules, in what
order, with what props — which a dumb renderer mounts.

It is a prototype. No auth, analytics, monitoring, i18n, CI or hardening, and the
fixture data is partly fabricated (`src/fixtures/README.md` marks which fields
are real). Do not treat any number in the fixtures as fact.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 208 tests, none of which call the model
npm run typecheck
npm run build
```

Check for a running dev server before starting one — `pgrep -fl "next dev"`. A
second `next dev` fails on the lock of the server you actually want.

## Spending money

A live call costs **$0.12–$0.22 and 40–180 seconds** on ~18,000 input tokens,
billed to whoever's `claude` CLI is signed in. There is no API key and no shared
budget; it is your own subscription.

- **One live call per change, and `?mode=eval` only.** Not `custom` — a scripted
  brief is reproducible and a typed one is not.
- **`/harness` is how you check visuals.** It renders every implemented module
  from fixture props and costs nothing. Use it after any component or token edit;
  do not re-compose a page to look at a card.
- **Opening `?mode=eval` is free.** It reads the cache and stops. Only pressing
  **Run composition** — a POST to `/api/compose` — can call the model.
- **A timeout at 180s still bills.** `TIMEOUT_MS` firing is the signal that the
  prompt or catalog has grown too large. Never raise it to stop it firing.
- **Every attempt is logged** to `.cache/calls.log`, failures included, with cost,
  duration, trigger and the brief. Cumulative spend questions get answered from
  that file, not from the drawer, which shows only the last call.

Editing `orchestrator/prompt.md`, `src/contracts/module-catalog.ts` or the
fixtures **invalidates every cached composition** — the cache keys on the exact
message plus the full system prompt text. Screenshot anything worth keeping
before a prompt edit.

## Git

**Never commit, branch, push or open a PR unless the repo owner asks.** Finish
the work and leave it in the working tree. This is not a habit to fall into at
the end of a task — it is an action the owner takes.

## The seams

- **`src/contracts/`** is the source of truth. Four Zod schemas — context, market,
  module catalog, layout spec. A change here changes what the model is sent.
- **`orchestrator/prompt.md`** is passed to the model *whole* on every call, so
  every word in it is billed every time. Version history belongs in
  `docs/PROMPT-HISTORY.md`, not in the prompt. Bump the `# Orchestrator prompt —
  vN` heading when you edit it; provenance parses it.
- **`src/shell/`** is chrome the model cannot compose away — navbar, footer,
  breadcrumbs, the full tour list. It does not go through the layout spec.
- **`src/orchestration/`** is the model seam. `bridge.ts` spawns the CLI,
  `validate.ts` repairs specs rather than discarding them, `cache.ts` and
  `ledger.ts` make spending visible.
- **`src/renderer/ComposedPage.tsx`** is deliberately dumb: it mounts what the
  validated spec says and makes no decisions.

Where a new rule belongs is answered in
[`docs/COMPOSABILITY.md`](docs/COMPOSABILITY.md): if the page would be *wrong*
when the rule is broken, enforce it in code; if it is a judgment about what
serves this visitor, put it in the prompt. A rule the model can reason its way
around is not a rule.

## Tests

`vitest.config.ts` sets `environment: 'node'` and includes `src/**/*.test.ts`
only, so the decision logic is covered and **all 25 `.tsx` files are untested by
design**. Component fidelity is checked by eye in `/harness`, not by assertion.
`src/orchestration/bridge.ts` is also untested — it spawns a subprocess.

## Style

Single quotes, no semicolons, 4-space indent, ~100 columns. `npm run format`
enforces it. Generated token files under `src/design-system/*/tokens*` are
excluded and marked "Do not edit directly" — regenerate, never hand-edit.

## Honesty

Never fabricate a number, a file path, a test result, or a verification you did
not run. Re-derive a figure before asserting it, and say plainly what you could
not check. "I cannot tell from this" is an acceptable answer; an invented one is
not.
