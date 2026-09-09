# Plan — `budget_entry`

**Read [`docs/HANDOFF.md`](HANDOFF.md) first.** It has the architecture, the
guardrails, and the landmines. This plan assumes it.

## Context

`budget_entry` is the one interaction in the MVP module set (source plan §4). It
matters more than its size suggests: today the visitor's budget arrives as a
fixture value and the demo switches between three canned contexts. With this
module the visitor *states* a number, and the page answers it. That is the
difference between a scripted demo and one Danny can hand someone.

It is also the cheapest way to make the composition visibly respond to a person
rather than to a persona we picked in advance.

**What exists already:** the catalog entry, its props schema (`prefill`), its
`propsHint`, and `context.stated_budget`, which `production_list` already filters
against via `filter.max_price`. What is missing is the component and the path
from a typed number back into the context.

## What this is for — read before building

Danny's demo is him narrating a visitor to a room, then **typing that context in
and watching the page compose itself.** The composability is the point: which
modules appear, in what order. Filters and inputs are well-understood product
surface and are not what anyone is being shown.

So the priorities, in order:

1. **The budget must arrive as context**, in the same bundle the model reads, so
   the orchestrator can compose around it.
2. **`budget_entry` exists mainly to give the orchestrator a second module to
   choose between.** With one placeable module it can only vary props; with two
   it starts making real composition decisions. That is the value here.
3. **The input itself should be plain.** Do not polish it. Spend the effort on
   the module's rendered state and on whether the orchestrator places it
   sensibly.

**Where the input lives: the developer console, not the page.** Put the budget
control in the `Shift+H` drawer next to the context switcher
(`src/demo/DemoBar.tsx`), and reuse that pattern rather than inventing one. That
is Danny's control surface — he is setting the visitor's context, not shopping.

`budget_entry` the *module* still renders on the page when the orchestrator places
it, because a page that asks "what's your budget?" is a real composition choice.
Keep that rendering simple: a label, a plain input, and a reflection of the
active budget. No validation choreography, no inline results.

**Where this is heading.** Eventually the console becomes a single freeform text
box — Danny types a sentence and the model infers the context from it. Real
visitors also arrive with *partial* context, so nothing downstream may assume a
complete one. Two consequences for this slice: do not build a structured
multi-field form that a text box would throw away, and make sure a missing budget
stays a first-class case rather than an error.

## The one real design decision

When the visitor enters a budget, where does the number go?

**Recommended: the URL — `?budget=140`.** `getServerSideProps` reads it, overrides
`stated_budget` on the selected variant's context, and everything downstream
follows from the context it already receives.

Why this over client state:

- **A budget is part of who the visitor is, not a filter control.** It therefore
  belongs in the context bundle the model reads. The page already builds its
  context from the address bar, so the URL puts it there for free.
- Modules stay pure functions of `(market, context, props)`. Holding a live
  budget in React state would be the first cross-module client state in the
  codebase, and it would live in two places — the browser and the context we
  send the model — which then have to be kept in sync.
- `specKeyFor()` already buckets on `stated_budget`, so a typed budget selects a
  different precomputed spec — the composition changes, not just the contents.
- It is the safer order. Adding instant in-page updating later is easy; starting
  with client state and later needing the model to see it means untangling two
  sources of truth.

Not a reason: shareable URLs. This runs on one laptop.

The cost is a page navigation rather than an instant local update. On a dev server
with the precomputed provider that is a fraction of a second. If it feels sluggish
in practice, add local state for the input's own value and keep the URL as the
source of truth on load — but do not start there.

**Consequence worth being explicit about.** The source plan (§5, Stage 1) said
this interaction should re-filter *contents, not composition*. That was written
when there was no live orchestration. Now:

- without `?live=1`, a new budget re-selects a precomputed spec — cheap, instant
- with `?live=1`, it re-orchestrates — about $0.08 and ~20s per submission

Both are honest. Submitting should therefore be an explicit action (button or
Enter), never debounced keystrokes — otherwise typing "140" bills three calls.

## Build

### 1. Budget from the URL

`pages/index.tsx` and `src/demo/variants.ts`. Read `query.budget`, parse it, and
apply it over the variant's context:

- Accept a positive integer. Ignore anything else and fall through to the
  fixture's value rather than erroring — a bad URL should not break the page.
- Clamp to something sane (say 20–2000). The cheapest ticket in the snapshot is
  $54; a $5 budget renders an empty list, and `validateLayout` already drops a
  `max_price` below the cheapest floor, so an out-of-range value produces a
  confusing "your filter was ignored" rather than an answer.
- Keep the variant's other fields untouched. Only `stated_budget` moves.

`variantBySlug` returning a variant whose context has been overridden is the
smallest change; the alternative is threading a second argument through, which
buys nothing.

### 2. `src/modules/budget-entry/`

A module component, same shape as the other two — `ModuleComponentProps<BudgetEntryProps>`
from `src/modules/types.ts`, registered in `src/modules/registry.ts`, and
`implemented: true` in the catalog.

Renders a label from the catalog's purpose ("What's your budget?"), a plain
number input prefilled from `props.prefill ?? context.stated_budget`, and a
submit that navigates with `budget` set (preserving `variant`, `live` and `bar`).

Plain is the requirement, not a compromise — see "What this is for" above.

Two things to get right rather than clever:

- **Preserve the other query params.** Losing `?live=1` on submit would silently
  drop the visitor back to precomputed and look like the model changed its mind.
- **Say what the budget is doing.** When a budget is active, the module should
  reflect it back ("showing dates from $54 to $140") so the connection between
  the input and the narrowed list is legible. That legibility is most of the
  module's demo value.

Visual language per `docs/HANDOFF.md`: DS primitives from `src/design-system/`,
tokens and type scale from `src/design/`, and match the Figma exactly where it
gives a value rather than approximating.

### 3. Budget control in the drawer

`src/demo/DemoBar.tsx`, beside the context switcher. Same visual language as the
variant buttons; a small input and a submit that navigates with `budget` set.
This is the control Danny actually uses while narrating, and it works whether or
not the orchestrator chose to place `budget_entry` on the page.

### 4. Make it placeable

- `implemented: true` on the catalog entry — that alone puts it in front of the
  orchestrator, since `catalogForPrompt()` filters on it.
- Two orchestrated modules now exist. `STRUCTURAL_RULES.minModules` can stay at 1
  until a third arrives; raising it to 2 is optional and low value.

### 5. Specs and evals

- The `no_budget` spec's reasoning already says it *should* lead with
  `budget_entry` once implemented — that is now true, so recompose that spec.
  Generate it through `?live=1` rather than hand-writing it, and record the real
  provenance.
- `orchestrator/eval/cases.test.ts`: add a case asserting that a context with no
  stated budget places `budget_entry`, and one asserting that a context with a
  budget does *not* (asking for a number you already have is the wrong page).
  That is the first eval that checks *which modules appear* rather than props —
  the property the prototype ultimately rests on.

### 6. Tests

Follow the existing split: unit-test the logic, verify the component visually via
`/harness`.

- Budget parsing: valid, missing, non-numeric, negative, absurd, clamping.
- Query-param preservation on submit.
- No test may call the model. If you mock the bridge, use the `vi.hoisted`
  pattern in `src/orchestration/live-fallback.test.ts` — see the landmine about
  rejections created inside a test body.

## Files

| File | Change |
| --- | --- |
| `src/modules/budget-entry/index.tsx` + `.module.scss` | new — the component |
| `src/modules/registry.ts` | register it |
| `src/contracts/module-catalog.ts` | `implemented: true` |
| `src/demo/variants.ts` | budget override from the URL |
| `src/demo/DemoBar.tsx` | budget control beside the context switcher |
| `pages/index.tsx` | read `query.budget` |
| `src/orchestration/specs/leah-onsale-no-budget.json` | recompose live |
| `orchestrator/eval/cases.test.ts` | module-presence assertions |
| `src/modules/budget-entry/*.test.ts` | parsing and param preservation |

## Verification

1. `npm run dev`. Load `/?variant=no-budget` — `budget_entry` should appear once
   the spec is recomposed.
2. `Shift+H`, enter 140 in the drawer, submit. The URL gains `?budget=140`, the
   list narrows to dates with a floor at or under it, and the module reflects the
   active budget back. This is the path Danny uses — check it first.
3. Enter 5. The page should stay coherent — clamped or ignored, never an empty
   list with no explanation.
4. Submit with `?live=1` present and confirm it survives the navigation, and that
   the drawer still reads `source: live`.
5. `Shift+H` → "What it composed" should show the narrowed rows and the count
   the filter removed.
6. `/harness` renders `budget_entry` at `standard`.
7. `npm test`, `npm run typecheck`, `npm run build`.
8. Screenshot beside the live vividseats.com performer page — the fidelity bar.

## Out of scope

Re-orchestrating on every keystroke, debounced live calls, persisting the budget
across sessions, and any change to `production_list`'s props. The list already
filters on `filter.max_price`; this module supplies the number, nothing more.

Also out of scope, deliberately: any polish on the input. No masks, no live
validation, no animated states, no multi-field context form. The freeform text
box that replaces this console is coming, and would discard all of it.
