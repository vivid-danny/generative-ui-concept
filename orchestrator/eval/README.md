# Composition evals

Source plan §7: context → expected-qualities test cases.

These assert *properties* of a composition rather than an exact layout — an
orchestrator that produces one correct-but-different layout should pass, while
one that ignores the context should fail.

Each case names a context fixture and the qualities its output must have, e.g.:

- price-sensitive paid-search entry → a price-lever module above the fold
- stated budget → every list module carries a `max_price` filter at or near it
- two contexts that differ → two layouts that differ

`eval/cases.ts` holds them as executable assertions, run by `npm test`. They are
worth keeping honest: the most likely failure mode of LLM composition is
convergence on one safe layout for every visitor, and only a property test
catches that.

## Retired, and owed back

`cases.test.ts` held nine of these and was deleted on 2026-09-10, along with the
precomputed spec library it read. It had stopped being an eval: it compared three
hand-authored specs written under prompt v2, keyed to the persona fixtures that
Base/Eval/Custom replaced. "Do different contexts produce different
compositions?" is the property that matters most here, and asking it of three
files someone wrote by hand answers nothing about the live orchestrator.

Most of what those tests asserted has direct coverage elsewhere — the
path-to-purchase rescue, prop repair and provenance are all in
`src/orchestration/validate.test.ts`.

What is genuinely owed back, at the live level:

- **Convergence.** Two contexts, two real calls, and an assertion that the
  rendered rows differ. Costs money per run, which is why it is not a unit test.
- **A stated budget constrains what the page shows.** Same shape: assert against
  what rendered, not against props.
- **Which modules appear.** Newly meaningful — until there were two placeable
  modules the question had one possible answer.

The shape to reach for: capture a live composition once, commit it with honest
provenance, and assert against it. That is a spec library again, but built from
real runs rather than hand-authored, which is the difference that made the old
one worthless.
