# Generative UI prototype

A Vivid Seats performer page whose layout is decided by an LLM at request time
rather than designed once for everyone. The same tour data produces a different
page for a Chicago fan with $80 than for someone who will fly — not different
copy in a fixed template, but different modules, in a different order, with
different props.

**Picking this up fresh?** Read [`docs/HANDOFF.md`](docs/HANDOFF.md) — current
status, the load-bearing decisions, the landmines, and what to do next. This file
is how to get it running.

---

## What you need

| | |
| --- | --- |
| **Node** | 24 (developed on v24.0.0) |
| **Claude Code CLI** | `claude` on your `PATH`, signed in. Developed against 2.1.267 |
| **An API key** | **No.** See below |
| **Network access** | Only what the CLI needs. The page itself fetches nothing |

Composition runs through the **Claude Code CLI under your own subscription
auth**, not an Anthropic API key — no org key was available and that was a hard
no, so `src/orchestration/bridge.ts` spawns `claude -p` as a subprocess. Two
consequences worth knowing before you plan anything around this: it cannot be
hosted, so this never runs on Vercel, and it only works on a machine where
someone is logged into Claude Code.

Check the CLI is ready before anything else:

```bash
claude --version        # any 2.x
```

## Running it

```bash
npm install
npm run dev             # http://localhost:3000
```

Then in another shell, as you like:

```bash
npm test                # 172 tests, none of which call the model
npm run typecheck
npm run build
```

**If a dev server is already running, do not start another.** Conductor starts
one for this worktree on **port 3100**. A second `next dev` fails with "Unable to
acquire lock at `.next/dev/lock`" — and that is the lock of the server you want,
not a stale one. Check first:

```bash
pgrep -fl "next dev"
```

Also check *which* app is on port 3000 before trusting a `curl`: `vivid-web-athena`
also runs there and serves a perfectly good page, just not this one.

## The three modes

`?mode=` selects what the page shows. **Only one of them costs money, and it
never spends it without a press.**

| mode | what the page gets | cost |
| --- | --- | --- |
| `base` (default) | No visitor context — the baseline every visitor gets today. Keeps the visitor's city, because the real page geolocates | free, never calls |
| `eval` | A scripted brief putting budget, distance, popularity and date in tension. See `src/fixtures/eval-scenarios.ts` | one call, then cached |
| `custom` | A brief you type into the drawer | one call per brief, on press, then cached |

Opening `?mode=eval` is **free and instant**. It reads the cache and stops. If
nothing has been composed for that brief yet you get the baseline page plus a
**Run composition** button in the drawer — pressing that is the only thing in the
system that can call the model.

## Driving the demo

**Press `Shift+H`** to open the developer drawer. It is hidden by default so the
page leads on its own, and opens on the left, pushing the page right rather than
covering it.

It holds, top to bottom:

- **Mode** — `Base` / `Eval` / `Custom`, and the brief each one hands over
- **Compose (one call)** / **Re-run (new call)** — the only path to a live
  call. In Custom it is the button directly under the textarea, and one press
  does the whole thing; there used to be a second button above it labelled
  "Compose" that only navigated, so the obvious press did nothing visible.
  Disabled the instant you press it, with an elapsed second count below, because
  a composition takes 40–180 seconds and silence used to look identical to a dead
  page
- **Briefs you have run** (Custom only) — the last five typed briefs, from the
  ledger, each marked *cached* (a free replay) or *needs a call*. Editing the
  system prompt flips every one of them from the first to the second
- **Estimated cost** — what the last call cost, failures included
- **Why this page** — the model's own reasoning for this composition
- **What it composed** — modules placed, rows that actually rendered, the top
  pick, and how many dates each filter removed
- **Provenance** — model, prompt version, timestamp, cost, duration, tokens
- **Validator** — every drop or repair, or "passed unmodified"
- **Raw model output** — the unparsed reply

Drawer state is remembered for the session and starts closed. It is deliberately
not in the URL: a query param survived navigation, so hiding the drawer and then
switching mode brought it straight back.

There is also `/harness` — dev only, unlinked. Every module at every size from
fixture props, for judging visual fidelity without a composition in the way. It
makes no calls, so it is the right place to check a component change after
editing the system prompt.

## What a call costs, and how to not spend it twice

**$0.12–$0.22 and 40–180 seconds**, on roughly 18,000 input tokens. The bridge
gives up at 180s (`TIMEOUT_MS`), and a timeout still bills — the tokens are spent
and there is no composition to show for it. **Do not raise that ceiling**; it
firing is the signal that the prompt or catalog has grown.

Three things keep spending deliberate:

- **Only a POST to `/api/compose` can call the model.** Rendering a page cannot.
  A GET is replayable by design — hot reload, a refresh, a second tab, a link
  prefetch — and that is how five calls once went through from two presses.
- **One call at a time, across the whole server.** Two presses for the same
  composition share one in-flight promise; anything else that arrives mid-call
  gets a 409 and spends nothing. It used to be one call per *cache key*, which
  stopped being a limit the moment briefs were typed rather than scripted — a
  new brief is a new key, so two tabs were two calls.
- **Every attempt is logged** to `.cache/calls.log`, failures included, with
  cost, duration, what triggered it, and **the brief it was composed from**. A
  typed brief lives in the URL and nowhere else, so this is what makes a
  composition findable again after the tab is gone. The drawer shows the last
  call — not a total; the total is reconstructable from the log, which is where
  a question about cumulative spend belongs.

Compositions are cached on disk under `.cache/` (gitignored), keyed on **the
exact message sent plus the full text of the system prompt**. So:

- Reloading a composed page is free, forever.
- Editing `orchestrator/prompt.md`, `src/contracts/module-catalog.ts` or the
  fixtures **invalidates every cached composition**, because all three change
  what the model is sent. The next press pays.
- A replay keeps the original call's cost in the panel, so it never looks free.

**If a tab is open on `?mode=eval` while you edit those files, that tab will not
spend anything** — the page cannot call. But you will lose the cached
composition, so screenshot anything you want to keep before a prompt edit.

## How a page gets composed

```
context + market ─→ OrchestrationProvider ─→ layout spec ─→ validator ─→ renderer ─→ modules
```

- **`src/contracts/`** — four Zod schemas: context, market, module catalog,
  layout spec. The single source of truth for everything else; changes should be
  additive and deliberate.
- **`src/orchestration/`** — the provider seam, `bridge.ts` (spawns the CLI),
  `cache.ts`, `ledger.ts`, and `validate.ts`. The validator **repairs rather than
  discards**: unknown modules are dropped, bad props are stripped back to their
  defaults, and the whole-page fallback is reserved for structural failure. Every
  intervention is recorded and shown in the drawer.
- **`src/modules/`** — module components and the registry. The catalog specifies
  more modules than exist; `implemented: false` keeps the two in step. Two are
  orchestrated today: `production_list` (main column) and `market_signals` (rail).
- **`src/renderer/`** — spec → components, keyed on module id plus heading so
  re-orchestration moves nodes rather than remounting them.
- **`src/shell/`** — navbar, header, the grid, tabs, filter chips, rail, SEO
  block, footer, and `FullTourList`. Static chrome the orchestrator cannot place
  or remove.
- **`src/demo/`** — the drawer, the modes, and `summarize.ts`.
- **`src/design/`** — tokens copied verbatim from `vivid-web-athena`, the Figma
  type scale as data, and the MUI theme wiring them together.
- **`orchestrator/prompt.md`** — the system prompt, read at call time. Its version
  history is in [`docs/PROMPT-HISTORY.md`](docs/PROMPT-HISTORY.md), deliberately
  *not* in the prompt file: the bridge passes that file whole, so every word in it
  is read by the model on every call.

Stack is **Next 16 Pages Router, MUI v6 + Emotion + SCSS modules, Zod, Vitest** —
matching `vivid-web-athena` on purpose, so ports are copy-and-rewire rather than
rewrite. Don't migrate it to Tailwind or App Router without a reason.

## What the model cannot compose away

Enforced in code regardless of what it decides, because a rule it can reason
around is not a rule:

- **The whole tour stays reachable.** `FullTourList` always offers every date.
- **No date appears twice on a page.** An exclusion set accumulated in section
  order; the first section to claim a date keeps it.
- **A section holds three rows at `hero`, seven otherwise**, and a module repeats
  at most three times.
- **At most one module in the rail**, which is 340px and hidden below 1248px.
- **The rail card always carries a demand reading and a price reading.**
- **A stat or badge with nothing behind it is dropped, not guessed at.**

[`docs/COMPOSABILITY.md`](docs/COMPOSABILITY.md) has the test for where a new rule
belongs: if the page would be *wrong* when the rule is broken, enforce it in code;
if it is a judgment about what serves this visitor, put it in the system prompt.

## Cloning this

Verified from a clean clone on 2026-09-14: `npm ci`, typecheck, 172 tests and
`next build` all pass, and the dev server serves `/`, `/harness` and the fonts
with no further setup. `/?mode=eval` works immediately and fires nothing — you
get the baseline page and a Run button.

You need Node 24 and the `claude` CLI signed in under **your own** subscription.
There is no `.env`, no API key, and no service to point at.

The planning material — the source plan, the slice breakdown, what to build next
— is deliberately outside the repo and will be deleted when building is done.
None of it is needed to run this. The `§` citations in `docs/` and in code
comments refer to it; treat them as footnotes, since the claim beside each one
is stated in full. `docs/HANDOFF.md` and this file stand on their own.

## Guardrails

- **Everything runs locally.** No network dependency on vividseats.com, any CDN,
  or any API — verified by recording every browser request. `media.vsstatic.com`,
  `a.vsstatic.com` and Cloudinary are unreachable here and 404, so commit assets
  to `/public` instead of hotlinking. `next.config.js` deliberately has no
  `images.remotePatterns`. The one exception is the CLI subprocess.
- `/Users/daniel.lopez/vividseats/vivid-web-athena` is **read-only**. Source is
  read and copied out; nothing is written back.
- **No commits, branches or PRs without Danny saying so. Never push.**
- **This is a prototype, not a production delivery.** No auth, analytics,
  monitoring, i18n, CI or hardening. Fixture data is partly fabricated —
  `src/fixtures/README.md` marks which fields are real.
