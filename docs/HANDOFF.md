# Handoff — state of the generative UI prototype

**Written:** 2026-09-02 · **Owner:** Danny Lopez
**Source of truth for intent:** `.context/attachments/RAZwKr/generative-ui-prototype-plan.md`
**Slice 1 plan:** `~/.claude/plans/system-instruction-you-are-working-partitioned-creek.md`

Read the source plan first — it holds the problem statement, the staging, and the
guardrails. This document says where the code actually is and what to do next.

---

## Status: slice 3 — the orchestrator composes sections

The page is composed at request time by `claude-sonnet-5`. 85 tests pass,
typecheck is clean, production build succeeds. Committed on
`vivid-danny/genui-concept-build`; nothing is pushed.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 85 tests, none of which call the model
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

- Place `production_list` **up to three times as sections**, each naming itself
  via `heading`.
- Scope a section by **price, city, demand, value, sales velocity, sellout risk,
  or a date's traits** — so a heading like "likely to sell out" has a real
  collection behind it rather than words over an unfiltered list.
- Sort by `date`, `price`, `value` or `demand`, and highlight one row.
- Choose **which badges a section may surface**, from five DS badges. An
  allowlist, not an instruction: a row shows one only if the section allowed it
  *and* the date qualifies, so rows share a vocabulary without being identical.
- Reason about **geography from city names alone** — no distance field, no tiers.
- Read a **freeform brief** that overrides the structured context.

### What it costs

About **$0.04 and 34 seconds** a call, after three changes worth knowing about:

- The market snapshot is minified. Indentation was ~3,000 tokens a call.
- The message is ordered stable-first, volatile-last, because prompt caching
  matches on a prefix and the brief was sitting ahead of 9,000 tokens of
  inventory that never changes.
- `--effort medium`. This was the big one — tokens fell 19% while cost fell 76%,
  so most of the saving was the model no longer thinking harder than the task
  needs.

**Watch the quality tradeoff.** At medium effort it scoped the drive-away
sections by city alone, where a high-effort run had also filtered on the
visitor's $80 ceiling. If compositions start reading carelessly, `--effort high`
now costs ~$0.10 rather than the $0.179 it did before, since the token cuts are
independent of effort.

### What it cannot compose away

`src/shell/FullTourList.tsx` sits below the composed column and always offers the
whole tour. It is shell chrome on purpose: a composition narrows, and "a customer
can still browse everything" has to hold regardless of what the orchestrator
decided. Anything the orchestrator places, it can also leave out — so this was
never given to it.

`/harness` and `/diff` exist and are deliberately unlinked.

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
sort/highlight were left unchanged — that wiring belongs with the module work below.

## Next steps

**How to decide what to build: read the eval output.** The loop is data → a
surface that exposes it → a line in the prompt or catalog describing it →
guardrails → one eval run → read what the model reached for that does not exist.
That last part is the sequencing signal, and it has been right every time so far:
the invented `focus_metro` prop is what led to sections, and the invented
`sort_by` is what led to `propsHint`.

**What the latest run exposed.** The brief says she "can drive a few hours **on a
weekend** but not fly." The model has no way to act on that — there is no
weekend or lead-time dimension in the filter, and `src/orchestration/derive.ts`
already computes `isWeekend`, `isWeeknight` and `daysOut` but is consumed by
nothing except its own test. That is the smallest gap with the clearest evidence
behind it.

Then, roughly in order:

1. **Weekend and lead time as filter dimensions.** Wire `derive.ts` into
   `selectProductions` and add the criteria to `FilterSchema`. A "weekend nights
   within driving distance" collection is exactly the shape the brief asks for
   and cannot currently be built.
2. **The slot freed beside the CTA.** The card's price moved into the button and
   left a gap. What earns it is an open design question — median price, a
   view-quality signal, inventory depth — and deciding it is the point, not
   filling it.
3. **Card variants beyond badges.** The composability Danny is most interested
   in: which secondary signal a section's cards lead with. Per
   `docs/COMPOSABILITY.md`, section-level and enumerated, never per row.
4. **Restore `STRUCTURAL_RULES.minModules` to 3** once three orchestrated modules
   exist. Still 1, because a floor of 3 would fail every spec — there is one
   placeable module, used up to three times.
5. **Extend the evals to compare rendered output**, and to assert that two
   contexts differ in *which modules appear* rather than only in props.

**Still unsurfaced data:** `inventory_by_tier` and `listings_sample`'s
`deal_score` are read by nothing at all. `price_trend_7d` reaches the page only
through the "Deals Available" badge. Each is a candidate surface, but let the
eval say which is wanted rather than building on inventory alone.

**A small honesty bug in the panel.** The drawer showed "replayed from cache" on
a composition made seconds earlier — Next's dev server appears to invoke
`getServerSideProps` twice on a cold compile, so the first call pays and caches
and the second replays. Only one call is billed, but the note misleads.

**Hosting is not near-term.** Vercel only becomes worth considering once the
local experience is solid, and live orchestration cannot go with it.

Deferred: `budget_entry` (see `docs/PLAN-budget-entry.md`), `date_compare`,
`venue_alternatives` — which may be unnecessary now that a list can section by
geography — `sellout_urgency`, ticket-level `listing_preview`, `screen-sm` mobile,
the assembly animation, session signals and live re-orchestration, real snapshot
capture.

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
