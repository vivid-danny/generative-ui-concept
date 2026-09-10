# Handoff — state of the generative UI prototype

**Written:** 2026-09-02 · **Owner:** Danny Lopez
**Source of truth for intent:** `.context/attachments/RAZwKr/generative-ui-prototype-plan.md`
**Slice 1 plan:** `~/.claude/plans/system-instruction-you-are-working-partitioned-creek.md`

Read the source plan first — it holds the problem statement, the staging, and the
guardrails. This document says where the code actually is and what to do next.

---

## Status: slice 4 — the orchestrator picks between modules

The page is composed at request time by `claude-sonnet-5`. 145 tests pass,
typecheck is clean, production build succeeds. Committed on
`vivid-danny/genui-concept-build`; nothing is pushed.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 145 tests, none of which call the model
npm run typecheck
npm run build
```

### The three modes

`Shift+H` opens the developer drawer. `?mode=` selects what to show:

| mode | what the page gets | cost |
| --- | --- | --- |
| `base` (default) | No visitor context. The baseline every visitor gets. | free, no call |
| `eval` | A scripted brief putting several levers in tension. | one call, then cached |
| `custom` | A brief typed in the drawer. | one call per brief, then cached |

Base keeps the visitor's city — today's real page geolocates, and framing the
baseline as context-free would argue against a page that does not exist. What it
does not do is compose.

Compositions are cached on disk under `.cache/` (gitignored), keyed on the brief,
the prompt version and the snapshot date. Reloading is free; editing
`orchestrator/prompt.md` invalidates everything; `?fresh=1` forces a new call. A
replayed composition keeps its original cost in the panel, so it never looks free.

### What the orchestrator can do now

- Choose **between two modules**: `production_list` in the main column and
  `market_signals` in the right rail. Which module appears is now a real
  decision, not just how the list is sliced.
- Place `production_list` **up to three times as sections**, each naming itself
  via `heading`.
- Scope a section by **price, city, demand, value, sales velocity, sellout risk,
  a date's traits, weekend vs weeknight, or lead time** — so a heading like
  "likely to sell out" or "weekend trips" has a real collection behind it rather
  than words over an unfiltered list.
- Sort by `date`, `price`, `value` or `demand`.
- **Name one date on the page as its top pick**, by production id, in the spec's
  page-level `top_pick`. That card gets a pink outline and a "Top Pick"
  tab on its top border. Fixed copy — the recommendation is the model's, the
  words are ours, and the *why* stays in `reasoning`. Page-level rather than a
  section prop, so "one per page" is true by construction rather than repaired
  back to one.
- Choose **which badges a section may surface**, from five DS badges. An
  allowlist, not an instruction: a row shows one only if the section allowed it
  *and* the date qualifies, so rows share a vocabulary without being identical.
- Choose **which reference point the row's get-in price gets**, via
  `card_signal` — the same date last week (`price_trend`), the other dates the
  section is showing (`price_gap_to_cheapest`), or the rest of the listings on
  that date (`typical_seat_price`). Section-level, so it renders on every row or
  none. That is the slot's stated purpose: "From $76" is one listing, often the
  worst seat in the building, and each option gives it a different reference.
- Compose the rail card by **picking which of eight stats appear, in order**.
  Every stat makes a claim about the tour, so its wording and its number are
  ours (`src/modules/market-signals/signals.ts`). Its title is fixed at
  "Event Trends" — the model already writes every heading in the main column,
  and a title that must stay true of any stat mix has nothing left for it to
  add.
- Reason about **geography from city names alone** — no distance field, no tiers.
- Read a **freeform brief** that overrides the structured context.

Where a module renders is **not** its decision. `region` is a property of the
module in the catalog, and the page mounts one `ComposedPage` per column. The
rail is 340px, sticky, and hidden below 1248px — that is form, and form does not
belong in props.

### What it costs

**$0.04–$0.20 a call, 34–143s.** Runs have come in at $0.043, $0.047, $0.116,
$0.158 and — the slice-4 run, with a second module in the catalog — **$0.202 in
143s on 15,953 input tokens**, the most expensive yet.

Adding a module is not free. The catalog now carries a second `propsHint`, a
`region` line per entry, and a new prompt section, and the composition itself is
longer. Whether that accounts for all of it or the run was simply unlucky is not
knowable from one call — see the variance note.

**Variance is as large as most effects you would try to measure.** A single run
cannot tell you what a prompt sentence costs. If that question matters, it needs
several runs per condition, which is a real spend — otherwise treat cost as a
range and move on.

Three changes got it down from ~$0.18:

- The market snapshot is minified. Indentation was ~3,000 tokens a call.
- The message is ordered stable-first, volatile-last, because prompt caching
  matches on a prefix and the brief was sitting ahead of 9,000 tokens of
  inventory that never changes.
- `--effort medium`, set explicitly in `src/orchestration/bridge.ts`. The
  biggest single lever — tokens fell 19% while cost fell 76%.

Reloading a composed page is free: `src/orchestration/cache.ts` keys on the exact
message plus the prompt text, so only a real change to either costs anything.

### What it cannot compose away

Three things are enforced regardless of what the orchestrator decides, because a
rule the model can reason its way around is not a rule:

- **The whole tour stays reachable.** `src/shell/FullTourList.tsx` sits below the
  composed column and always offers every date. Shell chrome, never a module —
  anything the orchestrator places, it can also leave out.
- **No date appears twice on a page.** An exclusion set the renderer accumulates
  in section order (`resolveExclusions` in
  `src/modules/production-list/select.ts`). The first section to claim a date
  keeps it.
- **A module repeats at most three times, each instance naming itself.**
  `STRUCTURAL_RULES` in `src/orchestration/validate.ts`.
- **A section holds three rows at `hero`, seven otherwise.**
  `STRUCTURAL_RULES.maxItemsBySize`. A count is a claim about confidence, so it
  is derived from prominence rather than chosen separately — a hero of eight
  claimed certainty and then read as a list. Clamped with a note only when the
  model asked for more than it can have; a trimmed default is not worth
  reporting. `FullTourList` bypasses the validator, which is why "see every
  date" can still be a wall of dates.
- **At most one module in the rail.** Three stacked cards in a 340px sticky
  column is a wrong page, not a judgment about a visitor. Same file
  (`maxPerSideRegion`).
- **A stat with nothing behind it is dropped, not guessed at.** Naming a stat is
  a request; `resolveSignals` drops what the snapshot cannot support, and a card
  whose stats all drop renders nothing.

`docs/COMPOSABILITY.md` has the test for deciding where a new rule belongs: if
the page would be *wrong* when the rule is broken, enforce it in code; if it is a
judgment about what serves this visitor, put it in the prompt and let the model
weigh it.

An empty section renders nothing rather than an empty state, and the drawer
reports it — distinguishing "no matches" from "already shown above", which tells
you the model wrote two sections that overlap.

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

## What exists

| Area | Files | Notes |
| --- | --- | --- |
| Contracts | `src/contracts/` | The four Zod schemas: context, market, module catalog, layout spec. Frozen apart from two additive amendments — see below. |
| Orchestration | `src/orchestration/` | The seam, `PrecomputedProvider`, **`LiveProvider` + `bridge.ts`** (spawns the Claude Code CLI), validator, fallback, 3 specs, `derive.ts` |
| Modules | `src/modules/` | `event_header` (chrome) and `production_list` implemented; 7 more specified. Every entry carries a `propsHint` the prompt shows the model |
| Renderer | `src/renderer/ComposedPage.tsx` | Spec → components, keyed by module id |
| Shell | `src/shell/` | Navbar, PageShell grid (header / main / rail / SEO slots), Breadcrumbs, PerformerTabs, PerformerFilters, PerformerRail, TrustBanner, SeoContent, Footer, Logo |
| Design | `src/design/` | Athena tokens copied verbatim, Figma type scale as data, MUI theme, grid constants |
| Design system | `src/design-system/` | `box`, `typography`, `chip` ported from athena (i18n stripped); local `icons` set (microphone, user, calendar, ticket, shield, heart, rewards) |
| Fixtures | `src/fixtures/` | Olivia Rodrigo ~52-date tour + 3 Leah contexts. **Read `src/fixtures/README.md`** — it marks which fields are real vs fabricated, and the authoring invariants the tests pin |
| Prompt | `orchestrator/prompt.md` | **v3.** Read at call time; provenance records the version that ran |
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

## How far composability goes

**Read [`docs/COMPOSABILITY.md`](COMPOSABILITY.md) before adding a module or a
prop.** It holds the rule that decides what this prototype is: the goal is not
infinite customizability but enough knobs to be genuinely relevant; content is
the model's and form is the component's; a prop that makes a claim gets
enumerated while a prop that frames or explains can be written freely; and
composition happens at the section, never the row.

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

**4. The bridge's CLI flags (`src/orchestration/bridge.ts`).**
`--tools "" --restricted --strict-mcp-config` are not incidental. Without them
every composition also carried Claude Code's tool definitions and every
configured MCP server's schemas: **53,448 input tokens and $0.57 per call, versus
15,065 and $0.081 with them.** Nothing is given up — those flags remove
permission gates and sandboxing that exist to govern tool use, and the
orchestrator has no tools; it returns JSON. Do not remove them to "restore
guardrails"; the guardrail that protects the page is `validateLayout`, downstream
of the model. Note `--restricted` also makes the CLI emit a JSON *array* rather
than an object, which `resultEntry()` handles.

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
- **`LayoutEntrySchema.props` is an open record, so module prop defaults do not
  apply just because a spec parsed.** `FALLBACK_LAYOUT` was built with
  `LayoutSpecSchema.parse` alone for three slices, so nothing on the base path
  ever ran a module's own `propsSchema`. Two visible bugs came from it: base drew
  a pink outline around whichever row sorted first (a `highlight` of `undefined`
  slipping a `=== null` guard) and base wore no badges at all. The fix runs each
  entry's `propsSchema` where `FALLBACK_LAYOUT` is built — anything that spreads
  it now gets real props. If a page shows something the AI path does not, suspect
  a default that never ran.
- **Never filter `spec.layout` before mapping it.** `resolveExclusions` returns
  an array aligned to position in the *whole* layout, and `ComposedPage` reads
  `exclusions[index]`. Filtering first silently hands each section another
  section's excluded dates — a wrong page with no error. Filter *while* mapping;
  `ComposedPage` does this for the region split.
- **A dev server may already be running, on port 3100.** Conductor starts one for
  this worktree. Starting a second fails with "Unable to acquire lock at
  `.next/dev/lock`" — and that is the lock of the server you want, not a stale
  one. Check `pgrep -fl "next dev"` and the port before touching anything under
  `.next/`.
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
- **Mock the composition cache in provider tests.** Left real, one test's
  composition is written to disk and served to the next, and the mock is never
  consulted. `src/orchestration/live-fallback.test.ts` mocks `./cache`.
- **`filteredOut` in `summarize.ts` means "removed by a filter", not "not
  shown".** The panel says the former. Conflating them makes `max_items`
  truncation report as filtering, which is a false statement in the one place the
  composition gets inspected. Across sections a date counts as filtered out only
  when no section's filter admits it.
- **Renderer keys are module id plus heading**, not the id alone, now that a
  module can repeat. Reverting to the id gives duplicate keys and breaks the
  identity the Stage 4 animation depends on.
- **A rejection created inside a test body fails that test**, even when the code
  under test caught it and every assertion passes. `mockRejectedValue`, an
  `async` throwing mock body, and a pre-`.catch()`ed rejected promise all do it.
  Drive the failure from inside the `vi.mock` factory via a `vi.hoisted` box
  instead — `src/orchestration/live-fallback.test.ts` is the working pattern.
- **Never delete `.next/dev` while a dev server is running.** It pulls the lock
  out from under it and every route starts returning 500 with no useful error.
  Only one `next dev` can hold the lock, so a second instance for a side-by-side
  test will not start either.
- **Check which app is on port 3000 before trusting a curl.** `vivid-web-athena`
  also runs there, and it returns a perfectly good page — just not this one.
- **The model invents props it has never been shown.** Before the catalog carried
  `propsHint`, a single live call produced 16 unrecognised props. The near-misses
  (`sort_by` for `sort`) are fixed by showing the schema; the rest
  (`focus_metro`, `deprioritize_beyond_region`) are the model telling you a
  module lacks vocabulary it needs. Read the validator notes as design feedback
  rather than noise — which is why the hard `--json-schema` constraint the CLI
  offers is deliberately *not* used yet. It would silence that signal.
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
sort was left unchanged — that wiring belongs with the module work below.

## Next steps

**How to decide what to build: read the eval output.** The loop is data → a
surface that exposes it → a line in the prompt or catalog describing it →
guardrails → one eval run → read what the model reached for that does not exist,
or had and did not use. That has been right every time: the invented
`focus_metro` prop led to sections, the invented `sort_by` led to `propsHint`,
and the ignored weekend constraint led to the rule that stated limits are
obligations.

**A lesson worth keeping.** Adding a surface is not enough on its own. The
weekend filter existed for a full run before the model touched it, because
nothing told it that a stated constraint had to be applied. When a new surface
goes unused, check whether anything says it *should* be — before reaching for
more effort or more data.

Roughly in order:

1. **Read whether the model now uses `card_signal`.** It declined it in four of
   five runs while there was one value, which was the model correctly following
   a `propsHint` that reserved `price_trend` for a visitor weighing *when* to
   buy — our brief is someone weighing *which date*. There are now three values
   and a stated purpose, so the next run says whether the surface was
   under-specified or genuinely unwanted. Candidates considered and cut are in
   the exploration worktree's `docs/CARD-SIGNAL-CANDIDATES.md`; the shortlist
   worth revisiting is a tour-level `price_vs_typical`, which flattens inside a
   price-filtered section and so is strongest in a broad one.
2. **`listing_preview`.** The one wanted module still missing, and the only one
   that pairs with a chosen date rather than the tour. Needs top-listings-per-
   event data, which the snapshot does not carry.
3. **Restore `STRUCTURAL_RULES.minModules` to 3** once a third orchestrated
   module exists. Still 1: two exist, and a floor of 3 would fall back on every
   good composition.
4. **Extend the evals to compare rendered output**, and to assert two contexts
   differ in *which modules appear* rather than only in props. Now worth doing —
   until slice 4 there was only one module, so "which modules appear" had one
   possible answer.

**Still unsurfaced data:** `inventory_by_tier` and `listings_sample`'s
`deal_score` are read by nothing at all. Each is a candidate surface, but let the
eval say which is wanted rather than building on inventory alone.
(`price_trend_7d` is no longer on this list — it now drives both `card_signal`
and the card's `price_direction` stat.)

## Retired on 2026-09-10

**The precomputed spec library, `/diff`, the persona fixtures, and nine evals.**
`src/orchestration/specs/*.json` held three compositions hand-authored under
prompt v2 and keyed to the persona fixtures that Base/Eval/Custom replaced.
`orchestrator/eval/cases.test.ts` compared them; `pages/diff.tsx` displayed them.

They went because `top_pick` replaced `highlight`, which was the only prop
distinguishing two of the three specs — so the convergence eval started failing
by design. That was the prompt to notice the whole thing had stopped being an
eval: "do different contexts produce different compositions?" is the property
that matters most here, and asking it of three files someone wrote by hand
answers nothing about the live orchestrator.

What replaced them: `LiveProvider.fallback()` now serves `FALLBACK_LAYOUT`, which
is the more honest failure — a page composed for somebody else, presented without
comment, is a worse lie than a page that plainly did not compose. Most of what
the nine tests asserted has direct coverage in `validate.test.ts` already. What
is genuinely owed back is recorded in `orchestrator/eval/README.md`: convergence,
budget-constrains-the-page, and which-modules-appear, all at the live level where
they mean something. `specKeyFor` survived the deletion in
`src/orchestration/context-key.ts` — provenance still uses it.

## Parked ideas

**Composed filters — the model composing controls, not content.** Instead of an
open-ended date picker, the orchestrator emits two or three one-tap filters
relevant to the brief: "Fri & Sat", "Under $80", "Within a drive". Danny's idea,
and a genuinely different class from everything built so far — every module to
date decides what to *say*; this one would decide what the visitor can *do*.

Why it is not scheduled: a filter that changes what is on the page interacts with
both code-enforced guarantees. The no-duplicate-dates exclusion set is computed
once per render in section order, so a filter that removes a date from section
one silently hands it to section two — which may be right, or may be a page that
reshuffles under the visitor. And the full-tour guarantee has to survive whatever
a filter does. Neither is unsolvable; both are more than an afternoon.

Stretch goal. Worth returning to once there are enough modules that composing
*controls* has something to control.

**A small honesty bug in the panel.** The drawer showed "replayed from cache" on
a composition made seconds earlier — Next's dev server appears to invoke
`getServerSideProps` twice on a cold compile, so the first call pays and caches
and the second replays. Only one call is billed, but the note misleads.

**Hosting is not near-term.** Vercel only becomes worth considering once the
local experience is solid, and live orchestration cannot go with it.

**Six catalog entries were reviewed and cut.** `sellout_urgency`, `price_trend`
and the editorial half of `date_compare` turned out to be the same component and
collapsed into `market_signals`. `venue_alternatives` is covered by the list's
city and geo filters; `budget_entry` by the budget already arriving in the
context (`docs/PLAN-budget-entry.md` is now history, not a plan); and
`view_from_seat_value` is seat-level detail, which is the wrong stage of shopping
for a page about choosing between dates. Leaving them in cost tokens on nothing
and invited the model to reach for decisions already made.

Deferred: ticket-level `listing_preview`, `screen-sm` mobile — which the rail
card also needs, since it vanishes below 1248px — the assembly animation, session
signals and live re-orchestration, real snapshot capture.

## Guardrails (source plan §8 — no exceptions)

1. **`/Users/daniel.lopez/vividseats/vivid-web-athena` is strictly read-only.**
   No writes, no git state changes, no installs, no builds, no formatters.
   Reading and copying source out is the only permitted interaction. Its
   Storybook therefore cannot be run — Figma plus live screenshots are the only
   rendered reference.
2. **No commits, branches, or PRs anywhere — including this repo — without
   Danny's explicit approval. Never push.** Approval is **per commit** and does
   not carry forward: "let's commit" for one change is not permission for the
   next. I got this wrong four times in one session by treating it as a habit
   rather than an action he owns. Finish the work, leave it in the working tree,
   say what is uncommitted, and ask.
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
