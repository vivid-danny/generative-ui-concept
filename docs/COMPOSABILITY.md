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

Generative is not free, though. The rail card started with a written heading and
lost it: the model already names every section in the main column, and a rail
title that has to stay true whether the stats are about price, demand or
inventory is general enough that nothing is added by generating it. **If the only
safe version of a free-text field is a generic one, make it a constant.**

**Selective** — the model picks from an enumerated set. Use where the text makes
a claim, where it must stay accurate, or where consistency across rows matters
more than novelty.

- Card badges — chosen from a pre-written list, never composed. A badge asserts
  something about inventory or price, so the wording is ours and vetted.
- The rail card's stats — same shape one level up. The model picks which facts
  about the tour appear and in what order; the sentence, the number and the
  card's title are all ours.
- Sort, highlight, size, filter fields
- Which secondary signal a section leads with (`card_signal`)

A useful corollary from the rail card: an **ordered** selective list carries more
intent than a set. The model saying "demand first, then price" is an editorial
judgment worth having, and it costs nothing over an unordered allowlist — where
each item then *sits* stays the component's decision.

The test: **if it makes a claim, enumerate it. If it frames or explains,
let the model write it.**

## Compose at the section, not the row

Card-level decisions apply to every card in a section, never to individual cards.

Two reasons. Fifty-two dates times per-card decisions is a spec that blows up in
size and cost — "in this section, lead with the crowd signal" is one prop, "for
card seven, show X" is fifty-two. And rows that differ from each other inside one
list are exactly what destroys comparability.

A card variant is a variant, not a freeform canvas.

## Inventiveness over consistency, for now

There is a live tension between a tighter composition and a more inventive one,
and we have chosen inventive.

The prompt once carried a closing instruction to re-read the brief and check each
section held to it. With it, every section came back carrying all of the
visitor's constraints — correct, and a little samey. Without it, the model
invented a section we had not imagined: "The biggest nights on the tour, for
reference", deliberately unfiltered, showing $236 New York and $214 LA to a
visitor with an $80 ceiling, framed as aspirational rather than buyable. That is
a better idea than anything in the prompt, and it came from leaving room.

So the line is out. **Put it back when the model starts making poorer choices**
— the likely trigger is more modules and more props, where the added optionality
crowds out care. The symptom to watch for is constraints going loose while the
shape stays plausible: a section headed for someone on a budget that quietly
opens with a date they cannot afford.

Two things make that reversible cheaply. The line is one paragraph in
`orchestrator/prompt.md`, and the rules that must not bend are enforced in code
rather than asked for in the prompt — see the next section.

## Hard rules go in code, not the prompt

A rule the model can reason its way around is not a rule. Two now live in code:

- **No date appears twice on a page.** Enforced by an exclusion set the renderer
  accumulates in section order (`resolveExclusions` in
  `src/modules/production-list/select.ts`), not by asking the orchestrator to
  track what it has already used. It fixed an existing composition — the same
  spec that had repeated a Chicago date rendered clean without a new call.
- **A module may repeat at most three times, and each instance must name
  itself.** `STRUCTURAL_RULES` in `src/orchestration/validate.ts`.
- **At most one module in the rail**, same file. Three stacked cards in a 340px
  sticky column is a wrong page however well-chosen each card is.
- **Where a module renders is not a prop at all.** `region` lives on the catalog
  entry and the renderer splits the layout by it. Choosing the rail is choosing
  340px, sticky positioning and desktop-only visibility — form, not content — so
  the orchestrator places a module and never says where it goes. This is the
  cleanest case of the rule two sections up: a knob that only ever has one right
  answer per module is not a knob.

The test for where a rule belongs: if the page would be wrong when the rule is
broken, enforce it in code. If it is a judgment about what serves this visitor,
put it in the prompt and let the model weigh it.

Note what this leaves the model free to do. The constraint rule in the prompt
says every section *that claims to answer* a stated limit must filter by it — and
the model found the gap, writing a section that declines to make that claim. That
is not a loophole to close; it is the model using the room the rule left it.

## What this means in practice

When adding a module or a prop, ask in order:

1. Does the orchestrator need this knob to be relevant, or am I adding it because
   it is possible?
2. Is it content or form? Form does not belong in props.
3. If content: does it make a claim? Then enumerate the options.
4. Does it apply to a section, or am I about to make rows diverge?
