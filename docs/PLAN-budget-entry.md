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

## The one real design decision

When the visitor enters a budget, where does the number go?

**Recommended: the URL — `?budget=140`.** `getServerSideProps` reads it, overrides
`stated_budget` on the selected variant's context, and everything downstream
follows from the context it already receives.

Why this over client state:

- It reuses the pattern already there. `?variant=` and `?live=1` work this way,
  and `variantBySlug` is the seam to extend.
- Modules stay pure functions of `(market, context, props)`. A React context
  holding a live budget would be the first piece of cross-module client state in
  the codebase, and it is not needed yet.
- The URL becomes shareable, which is useful when Danny is driving.
- `specKeyFor()` already buckets on `stated_budget`, so a typed budget selects a
  different precomputed spec — the composition changes, not just the contents.

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

Renders a labelled number input, prefilled from `props.prefill ?? context.stated_budget`,
and a submit that navigates to the same URL with `budget` set (preserving
`variant`, `live` and `bar`). Something like "What's your budget?" per the
catalog's purpose line.

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

### 3. Make it placeable

- `implemented: true` on the catalog entry — that alone puts it in front of the
  orchestrator, since `catalogForPrompt()` filters on it.
- Two orchestrated modules now exist. `STRUCTURAL_RULES.minModules` can stay at 1
  until a third arrives; raising it to 2 is optional and low value.

### 4. Specs and evals

- The `no_budget` spec's reasoning already says it *should* lead with
  `budget_entry` once implemented — that is now true, so recompose that spec.
  Generate it through `?live=1` rather than hand-writing it, and record the real
  provenance.
- `orchestrator/eval/cases.test.ts`: add a case asserting that a context with no
  stated budget places `budget_entry`, and one asserting that a context with a
  budget does *not* (asking for a number you already have is the wrong page).
  That is the first eval that checks *which modules appear* rather than props —
  the property the prototype ultimately rests on.

### 5. Tests

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
| `pages/index.tsx` | read `query.budget` |
| `src/orchestration/specs/leah-onsale-no-budget.json` | recompose live |
| `orchestrator/eval/cases.test.ts` | module-presence assertions |
| `src/modules/budget-entry/*.test.ts` | parsing and param preservation |

## Verification

1. `npm run dev`. Load `/?variant=no-budget` — `budget_entry` should appear once
   the spec is recomposed.
2. Enter 140, submit. The URL gains `?budget=140`, the list narrows to dates with
   a floor at or under it, and the module reflects the active budget back.
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
