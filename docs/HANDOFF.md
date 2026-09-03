# Handoff — state of the generative UI prototype

**Written:** 2026-09-02 · **Owner:** Danny Lopez
**Source of truth for intent:** `.context/attachments/RAZwKr/generative-ui-prototype-plan.md`
**Slice 1 plan:** `~/.claude/plans/system-instruction-you-are-working-partitioned-creek.md`

Read the source plan first — it holds the problem statement, the staging, and the
guardrails. This document says where the code actually is and what to do next.

---

## Status: slice 1 complete

The performer page shell renders, composed at request time from a validated
layout spec. 43 tests pass, typecheck is clean, production build succeeds.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 43 tests
npm run typecheck
npm run build
```

`Shift+H` toggles the developer drawer. It is hidden by default and opens on the
left, pushing the page right rather than stacking above it, so you can switch
context and watch the page change without the panel in the way. It shows the
context switcher, the orchestrator's reasoning, **what it actually composed**
(modules placed plus the rows that rendered), provenance, validator notes, and
the raw model output. State is local and always starts closed — deliberately not
in the URL, since a query param survived navigation and kept re-opening it.

`/harness` (every module at every size) and `/diff` (the three compositions side
by side with a convergence pass/fail) exist but are deliberately unlinked.

### Danny drives the demo

Don't build for a viewer exploring on their own. There is no need for
discoverable affordances on the developer drawer, onboarding hints, guided tours,
or self-service polish — Danny is at the keyboard and narrating. Spend the effort
on the thing being demonstrated (dynamic data, LLM-composed layout) rather than
on demo scaffolding.

### The shell is ahead of the slice-1 plan

Danny has since done design passes on the page, so the shell is more complete
than the slice-1 plan describes. Where the plan and the code disagree, **the code
is current.** Notably: real SVG brand assets replaced hand-drawn placeholders,
the performer image now overlaps the header (matching the Figma `rightCol`
offset), the tabs / filter chips / trust panel exist, the SEO block was built
after being cut from slice 1, and the developer panel became a left drawer.

### ⚠️ Nothing is committed

The entire build is untracked in git — `git log` shows only "Initial commit".
Per the source plan §8, commits need Danny's explicit approval, and it has not
been given. **If the next session starts in a new Conductor workspace, it will
get an empty repo.** Either work in this workspace, or get approval to commit
first.

---

## What exists

| Area | Files | Notes |
| --- | --- | --- |
| Contracts | `src/contracts/` | The four Zod schemas: context, market, module catalog, layout spec. Frozen apart from two additive amendments — see below. |
| Orchestration | `src/orchestration/` | `OrchestrationProvider` seam, `PrecomputedProvider`, validator, fallback, 3 specs + provenance |
| Modules | `src/modules/` | `event_header`, `production_list` implemented; registry; 6 more specified but not implemented |
| Renderer | `src/renderer/ComposedPage.tsx` | Spec → components, keyed by module id |
| Shell | `src/shell/` | Navbar, PageShell grid (header / main / rail / SEO slots), Breadcrumbs, PerformerTabs, PerformerFilters, PerformerRail, TrustBanner, SeoContent, Footer, Logo |
| Design | `src/design/` | Athena tokens copied verbatim, Figma type scale as data, MUI theme, grid constants |
| Design system | `src/design-system/` | `box`, `typography`, `chip` ported from athena (i18n stripped); local `icons` set (microphone, user, calendar, ticket, shield, heart, rewards) |
| Fixtures | `src/fixtures/` | Olivia Rodrigo ~52-date tour + 3 Leah contexts. **Read `src/fixtures/README.md`** — it marks which fields are real vs fabricated, and the authoring invariants the tests pin |
| Prompt | `orchestrator/prompt.md` | v1. Every spec records the `prompt_version` that produced it |
| Evals | `orchestrator/eval/cases.test.ts` | Property tests, incl. the anti-convergence check |
| Demo chrome | `src/demo/` | `DemoBar` drawer, context variants, and `summarize.ts` — "what it composed", shared with `/diff` so the two cannot drift |

### Everything runs locally — keep it that way

The prototype has **no network dependency on vividseats.com, any CDN, or any
API.** Verified by recording every browser request: 38 requests, all to
`localhost`, zero external hosts. Everything the page needs is committed under
`/public` — the four GT Walsheim faces, `vslogo.svg`, `vslogo-white.svg`,
`header-triangles.svg`, `footer-triangles.svg`, and the performer image. Market
data and contexts are JSON fixtures, and there are no `fetch`/`axios` calls
anywhere in `src`.

Two consequences worth respecting:

- **Add assets to `/public`, don't hotlink them.** `media.vsstatic.com`,
  `a.vsstatic.com` and Cloudinary are not reachable from here — those URLs 404,
  so reaching for one costs time and yields a broken image. `next.config.js`
  deliberately has no `images.remotePatterns`, so a remote `next/image` source
  fails rather than silently introducing a CDN dependency.
- **The one future exception is the live LLM call** (Stage 3). That is a
  server-side call behind `OrchestrationProvider`, not an asset or data fetch
  from the site.

### Stack

Next.js 16 **Pages Router**, MUI v6 + Emotion + SCSS modules, Zod, Vitest. This
matches `vivid-web-athena` deliberately (see Deviations) — do not migrate it to
Tailwind or App Router without a reason.

---

## The seams that matter

Three decisions are load-bearing. Changing them is expensive; understand them
before touching either.

**1. `OrchestrationProvider` (`src/orchestration/provider.ts`).** The only way
the page gets a layout. Swapping precomputed specs for a live LLM call is a
one-line provider change with nothing downstream affected. This is the whole
point of the architecture — keep it intact.

**2. Stable module keys (`src/renderer/ComposedPage.tsx`).** Modules are keyed by
module id, never array index. Stage 4 ("the page visibly sharpens as it learns")
needs React to *move* existing nodes on re-orchestration rather than unmount and
remount them. If it remounts, recomposition reads as a page reload — as a bug.

**Contract amendments so far.** Contracts are frozen in the sense that changes
should be additive and deliberate, not that they can never move. Two have
happened, both on `market.ts`, both backward-compatible:

- `performer.image_url` accepts a local `/public` path as well as a URL, because
  assets are committed rather than fetched (guardrail 3).
- `performer.tour_name` added as optional. The header and SEO copy use it when
  present and fall back to a derived date-range line when absent.

Anything less mechanical than these — a new required field, a changed shape —
should be raised rather than absorbed, because the specs in
`src/orchestration/specs/` and the fixtures are validated against them.

**3. Repair, don't discard (`src/orchestration/validate.ts`).** The plan's §3.4
says "on any validation failure render the fallback", but taken literally one bad
prop throws away an otherwise good composition. So: unknown/unimplemented/chrome
modules are dropped, bad props are stripped back to their schema defaults, and
the whole-page fallback is reserved for structural failure. Every intervention is
recorded in `notes` and surfaced in the panel — a validator that silently fixes
things cannot be trusted or debugged.

---

## Deliberate deviations from the source plan

Do not "fix" these. Each was a considered call.

1. **Pages Router + MUI/Emotion/SCSS, not App Router + Tailwind** (§2). Athena is
   MUI+Emotion+SCSS on Pages Router; matching it makes ports copy-and-rewire
   instead of rewrite. Tailwind would have made fidelity — already the schedule
   risk — significantly worse.
2. **Token "extraction" is a file copy** (§4 rule 1). Athena already commits one
   clean DTCG token set. Most of that task did not exist.
3. **`vivid_ui_kit`-dependent components are rebuilt from Figma, not ported**
   (§4 rule 2). See Landmines.
4. **`production_list` (dates) instead of `listing_preview` (tickets)** in slice 1.
   The performer page's repeating unit is a Production Card. Ticket-level preview
   is specified in the catalog but unimplemented, awaiting a production-page design.
5. **`STRUCTURAL_RULES.minModules = 1`, not 3** (§3.4). With one orchestrated
   module implemented, a floor of 3 would fail every spec. **Restore it to 3 in
   slice 2** once enough modules exist.
6. **i18n descoped.** `useTranslations()` is stripped on port; children render directly.
7. **Testing:** contracts, validator, selection logic, and evals are unit-tested;
   components are verified visually via `/harness` and screenshots. A deliberate
   departure from the 80% coverage standard, on the grounds that this is
   throwaway prototype UI.

---

## Landmines already hit

Each of these cost real time. Do not rediscover them.

- **`@vividseats/vivid-ui-kit` is unavailable.** Deprecated, behind private
  Artifactory, and *not installed* in the athena checkout. Any athena component
  importing `Card`/`CardImage`/`CardBody`/`Icon`/`Pill`/`Row` cannot be ported —
  rebuild from Figma instead. This rules out `performer/.../header` (313 LOC),
  `performer-card`, `header-card-image`, and `production/.../listing-row` (432 LOC).
  What *is* portable: `src/components/shared/production-listing-row` (169 LOC) and
  athena's `design-system/components/*` primitives.
- **`.module.scss` files are always copyable**, even when the `.tsx` is not. They
  are the best source for exact spacing and breakpoints.
- **`@mui/material-nextjs@6.5` peer-deps only next ≤15.** Resolved with an npm
  `overrides` block pinning next 16.1.6 — the same fix athena uses, so it is
  proven, not speculative.
- **Zod reports unknown keys with an *empty* path** and the names in
  `issue.keys` (`unrecognized_keys`). Handling only path-bearing issues made every
  hallucinated prop unrepairable and fell whole pages back to the static layout.
- **Fixture dates are venue-local wall-clock strings** with no offset. Do not pin
  a formatter to UTC — it shifts every date forward a day and disagrees with the
  card on the page.
- **GT Walsheim Black is weight 800, not 900.** Declaring 900 leaves 800 requests
  unmatched and the browser synthesizes a fake bold that just reads as "slightly
  off". All four faces are self-hosted in `public/fonts`.
- **Figma's `get_variable_defs` needs a live selection** in the desktop app, and
  it is far more reliable than eyeballing screenshots — it returns the exact
  bound tokens. Use it per node. It also revealed type styles absent from the
  type-scale frame (`Small/Medium`, `Small/Bold`, `Caption/Medium`).
- **The type-scale frame is not the whole scale.** `Body/Medium/Text` is declared
  with weight 400, identical to `body` — name and value disagree. It is
  deliberately not modelled; don't add it without deciding which is right.

---

## Open decisions for Danny

**1. Four hardcoded figures should become data-driven.** Not a blocking decision —
just work to do.

- `src/modules/event-header/index.tsx` — "🔥 10,302 fans recently purchased"
- `src/shell/PerformerRail.tsx` — `FANS_SHOPPING_NOW = 343`
- `src/shell/Navbar.tsx` — "over 190 million sold"
- `src/shell/TrustBanner.tsx` — "100 million sold"

⚠️ The last two disagree with each other on the same page — the navbar says 190
million, the rail's trust panel says 100 million. Whichever is right, they should
match; it is cheap to fix and awkward if someone reads both.

All four match the Figma faithfully, and surfacing demand and scarcity is legitimate
and useful to a buyer — §7 is explicit that urgency is information, not
decoration. The issue is narrower: these are constants, so they would read
identically for every event and every visitor. The prototype exists to show real
dynamic data and a UI composed from it at runtime, and a fixed number
demonstrates neither.

Fix the two performer-specific ones by backing them with snapshot fields.
`listing_count`, `sellout_risk` and `inventory_by_tier` already exist per
production; a `recent_purchases` or `shoppers_now` field on `performer` or
`productions` would carry these directly, and should be marked
fabricated-derived in `src/fixtures/README.md` like the other derived signals.
The two company-wide figures are static site copy, so they only need to agree.

**2. ~~Live orchestration route~~ — settled.** No org API key is available and
that is a hard no, so **Stage 3 is a local bridge through Claude Code
subscription auth.** A laptop demo driven by Danny is the accepted delivery
model, not a shortfall to engineer around. Consequences:

- Live orchestration cannot be hosted, so it never runs on Vercel.
- Precomputed specs remain the path for anything not driven from the laptop, and
  the provenance panel remains how that claim stays honest.
- Nothing before Stage 3 depends on it — `OrchestrationProvider` isolates it.

**3. A production-page Figma design** is needed before ticket-level
`listing_preview` can be built. Only the performer page has been supplied.

---

## Data foundation (2026-09-03)

The market snapshot was enriched before the slice-2 modules were built, so the data
they read already exists. Each production now carries `demand_score`,
`sales_velocity`, and `value_score` (all fabricated-derived, in the README ledger);
day-of-week and lead time derive from `date` via `src/orchestration/derive.ts`; the
context gained an `experience_first` intent; and the orchestrator prompt is at v2
with a "Signals available" section describing them. The fixture is a full ~52-date
tour. The three precomputed specs were hand-refreshed for the bigger market and want
a real regeneration once the live bridge exists — see the README's spec note. What
is **not** done: no module renders the new signals yet, and `production_list`'s
sort/highlight were left unchanged — that wiring belongs with the module work below.

## The next batch (slice 2)

**The gap to close:** slice 1 proves the pipeline and the look, but composition
currently varies only by *props* — the same single module with different filters.
The prototype's actual thesis is that **which modules appear, and in what order,
changes per visitor.** Nothing demonstrates that yet. That is slice 2's job, and
it is the difference between a nice mock and the argument the source plan wants
to make.

Suggested order:

1. **`budget_entry`** (`src/modules/budget-entry/`). The MVP's one interaction
   (§4). Turns budget from a URL param into something the visitor states, and
   re-filters downstream module contents client-side — contents, not composition.
   Catalog entry and props schema already exist; this is a component plus wiring.
   Note the `Shift+H` handler already ignores keystrokes in form fields, for this.
2. **`sellout_urgency`**. Scarcity is real, useful information (§7); the module's
   job is to read it off `sellout_risk` / `listing_count` / `inventory_by_tier`
   rather than assert a fixed figure. Worth doing open decision 1 alongside it.
3. **`price_trend`** — `@mui/x-charts` is what athena uses for sparklines, though
   it is not yet a dependency here.
4. **Restore `STRUCTURAL_RULES.minModules` to 3** in `src/orchestration/validate.ts`
   once three orchestrated modules are implemented. Deviation 5 exists only
   because of the current module count.
5. **New precomputed specs.** Compose them genuinely per context — read
   `orchestrator/prompt.md` and decide, rather than filling in a template. Record
   provenance (model, prompt version, timestamp, raw response) for each. The
   existing three in `src/orchestration/specs/` are the pattern.
6. **Extend the evals.** `orchestrator/eval/cases.test.ts` currently asserts the
   three variants do not converge. With more modules, add: a price-sensitive
   entry surfaces a price-lever module above the fold; two personas differ in
   *which modules appear*, not just props.
7. **More personas** (§5, Stage 2): a flexible fan browsing months out, a
   premium view-first buyer, a gift buyer. ⚠️ Check these against the snapshot —
   the current fixture is one hot onsale 94 days out, which does not support a
   "browsing 6 months out" persona. Either extend the fixture's timing profiles
   or constrain the personas to what the data supports.

Deferred beyond that: ticket-level `listing_preview` (needs decision 3),
`date_compare`, `view_from_seat_value`, `screen-sm` mobile (Figma `17055:179204`,
375 wide), the composition-assembly animation, session signals and live
re-orchestration (Stage 4), real snapshot capture.

**Hosting is not near-term.** Vercel only becomes worth considering once the
local-only experience is solid, and live orchestration cannot go with it. Build
for `npm run dev` on a laptop; do not add deployment config, environment
plumbing, or hosting workarounds ahead of that decision.

(The SEO block, originally cut from slice 1, is now built — `src/shell/SeoContent.tsx`,
fully derived from the snapshot.)

---

## Guardrails (source plan §8 — no exceptions)

1. **`/Users/daniel.lopez/vividseats/vivid-web-athena` is strictly read-only.**
   No writes, no git state changes, no installs, no builds, no formatters.
   Reading and copying source out is the only permitted interaction. Its
   Storybook therefore cannot be run — Figma plus live screenshots are the only
   rendered reference.
2. **No commits, branches, or PRs anywhere — including this repo — without
   Danny's explicit approval. Never push.**
3. **Assets and data are local. Never fetch from Vivid Seats hosts.** No requests
   to `media.vsstatic.com`, `a.vsstatic.com`, Cloudinary, or any `vividseats.com`
   endpoint — there are no credentials or CDN access here and **those requests
   404.** Commit assets to `/public`; keep market data in JSON fixtures. See
   "Everything runs locally" above. The one future exception is the server-side
   LLM call behind `OrchestrationProvider`.
4. **This is a prototype, not a production delivery.** Optimise for the shortest
   honest path to something demoable. Do not add auth, analytics, error
   monitoring, i18n, feature flags, caching, CI, or production hardening — the
   source plan §9 lists these as out of scope, and building them spends the
   schedule on what the demo never shows. Test where a silent bug would cost a
   demo (contracts, validator, composition logic) and verify components visually
   rather than chasing coverage. Prefer a fixture over a pipeline and a clear
   deviation over an unrequested abstraction. If something looks under-built,
   check §9 and the Deviations list before "fixing" it.
5. When unsure whether an action violates 1–4, stop and ask.

## Reference

- Design system Figma: fileKey `QITaTxYPUrqmzzB6NVayVu` (type scale at `18623:1780`)
- Performer page Figma: fileKey `d48AxLOJnqPC4Wb5gQhJGF` (`screen-xl` at `17055:178919`,
  `screen-sm` at `17055:179204`, header `17055:178925`, production card `17055:178943`,
  rail `17055:178973`)
- Screenshots and Figma reference crops: `.context/screens/`, `.context/reference/`
