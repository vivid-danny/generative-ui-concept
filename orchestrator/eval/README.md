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
