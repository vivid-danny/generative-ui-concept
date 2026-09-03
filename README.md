# Generative UI prototype — slice 1

A Vivid Seats performer page whose composition is decided by an LLM rather than
designed once for everyone. The framework and staging live in the source plan
(`.context/attachments/RAZwKr/generative-ui-prototype-plan.md`); this repo is
**slice 1**: the performer page shell, composed from a validated layout spec.

**Picking this up fresh? Read [`docs/HANDOFF.md`](docs/HANDOFF.md) first** — it has
current status, the load-bearing decisions, the landmines, open questions, and
the next batch of work.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # contracts, validator, and composition evals
npm run typecheck
```

## Pages

| Route | What it is |
| --- | --- |
| `/` | The demo. Nothing but the page itself. |
| `/harness` | Dev only, unlinked. Every module at every size it offers, from fixture props — the surface for judging visual fidelity without the composition in the way. |
| `/diff` | Dev only, unlinked. The three compositions side by side, with a pass/fail on whether they actually differ. Guards against the orchestrator converging on one layout for every visitor. |

### Driving the demo

**Press `Shift+H`** to show or hide the developer drawer. It is hidden by default
so the page leads on its own, and opens on the left, pushing the page right
rather than stacking above it — so you can switch context and watch the page
change without the panel in the way.

It holds, in order:

- the **context switcher** — `$80` / `$250` / no budget stated
- **Why this page** — the orchestrator's own reasoning for this composition
- **What it composed** — the modules placed, and the rows that actually
  rendered, including which one is highlighted and how many dates the filter
  removed
- **Provenance** — model, prompt version, generation timestamp, and whether the
  spec was composed ahead of time or live
- **Validator** — every drop or repair applied to the spec, or "passed unmodified"
- **Raw model output** — the unparsed response

State is local to the page and always starts closed. It is deliberately *not* in
the URL: a query param survived navigation, which meant hiding the drawer and
then switching context brought it straight back.

## How a page gets composed

```
context + market ─→ OrchestrationProvider ─→ layout spec ─→ validator ─→ renderer ─→ modules
```

- **`src/contracts/`** — the four schemas (context, market, module catalog,
  layout spec). Zod, and the single source of truth for everything else. Changes
  should be additive and deliberate; see the amendments noted in
  [`docs/HANDOFF.md`](docs/HANDOFF.md).
- **`src/orchestration/`** — the provider seam, the precomputed spec library, and
  the validator. `PrecomputedProvider` reads specs composed by Claude during
  development; Stage 3 swaps in a live call behind the same interface.
- **`src/modules/`** — module components plus the registry. The catalog specifies
  more modules than are implemented; `implemented: false` keeps the two in step.
- **`src/renderer/`** — spec → components. Keys are module ids, never indices, so
  a future re-orchestration moves nodes instead of remounting them.
- **`src/shell/`** — navbar, header region, the grid (main column + rail + SEO
  slots), tabs, filter chips, rail with trust panel, SEO block, footer. Static
  chrome; the orchestrator does not place any of it.
- **`src/demo/`** — the `Shift+H` drawer, the context variants, and
  `summarize.ts`, which turns a spec into what actually rendered. Shared with
  `/diff` rather than duplicated, so the two cannot quietly disagree.
- **`src/design/`** — tokens copied verbatim from `vivid-web-athena`, the Figma
  type scale as data, and the MUI theme that wires them together.

## What slice 1 does and does not show

It proves the pipeline and the visual fidelity. It does **not** yet demonstrate
the recomposition thesis: `event_header` is page chrome and `production_list` is
the only orchestrated module implemented, so composition currently varies by
props rather than by which modules appear. What it does show is genuine — the
same market data produces five price-sorted dates under $80 or all seven
chronologically, from the same code.

Composition is **precomputed**, not live (no API key available yet). Because
"an LLM composed this" would otherwise be unverifiable, every spec ships with
provenance — model, prompt version, timestamp, raw response — and the demo
surfaces it on screen alongside every repair the validator made.

## Guardrails

- `/Users/daniel.lopez/vividseats/vivid-web-athena` is **read-only**. Source is
  read and copied out; nothing is ever written back.
- No commits, branches, or PRs without Danny's explicit approval. Never push.
- **No network calls to Vivid Seats hosts.** `media.vsstatic.com`,
  `a.vsstatic.com` and Cloudinary are unreachable here and return 404 — commit
  assets to `/public` and keep data in fixtures instead.
- **This is a prototype, not a production delivery.** No auth, analytics,
  monitoring, i18n, CI, or hardening; see §9 of the source plan for the full
  out-of-scope list before adding infrastructure.
