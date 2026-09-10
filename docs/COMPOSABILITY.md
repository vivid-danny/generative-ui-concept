# How far composability goes

The rule that governs every module added to the catalog. Written down because it
is the question that decides what the prototype actually is.

## The goal is not infinite customizability

It is **enough knobs that the orchestrator can produce something genuinely
relevant** for a section or a context — and no more than that.

Unbounded permutation is not the ambition and would work against the product.
The list only functions as a list because every row reads the same way; fifty
differently-shaped cards stop being scannable, and comparing options is the whole
job of the page. Consistency, hierarchy and legibility are requirements, not
constraints we tolerate.

## Content is the model's, form is the component's

The orchestrator decides **what to say and what to show**. The component decides
**how it looks** — type scale, spacing, colour, badge treatment, layout.

This is the line that keeps the renderer dumb, and it is what stops "the LLM
composes the UI" collapsing into "the LLM writes the page" with the design system
discarded along the way. It is also consistent with what already works: the model
wrote the section heading, the component styled it.

## Two classes of knob

Every prop is one or the other, and which one is a deliberate decision:

**Generative** — the model writes free text. Use where the value is in being
bespoke and a wrong answer is merely unhelpful.

- Section headings ("Milwaukee — an easy weekend drive")
- The page headline
- `reasoning`

**Selective** — the model picks from an enumerated set. Use where the text makes
a claim, where it must stay accurate, or where consistency across rows matters
more than novelty.

- Card badges — chosen from a pre-written list, never composed. A badge asserts
  something about inventory or price, so the wording is ours and vetted.
- Sort, highlight, size, filter fields
- Which secondary signal a section leads with

The test: **if it makes a claim, enumerate it. If it frames or explains,
let the model write it.**

## Compose at the section, not the row

Card-level decisions apply to every card in a section, never to individual cards.

Two reasons. Fifty-two dates times per-card decisions is a spec that blows up in
size and cost — "in this section, lead with the crowd signal" is one prop, "for
card seven, show X" is fifty-two. And rows that differ from each other inside one
list are exactly what destroys comparability.

A card variant is a variant, not a freeform canvas.

## What this means in practice

When adding a module or a prop, ask in order:

1. Does the orchestrator need this knob to be relevant, or am I adding it because
   it is possible?
2. Is it content or form? Form does not belong in props.
3. If content: does it make a claim? Then enumerate the options.
4. Does it apply to a section, or am I about to make rows diverge?
