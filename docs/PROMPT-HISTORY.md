# Orchestrator system prompt — version history

Moved out of `orchestrator/prompt.md` on 2026-09-14. The bridge passes that file
to the model whole (`--system-prompt-file`), so every word in it was read on
every call — and 644 of them were this, addressed to us. Two entries had also
started to contradict the live instructions: v6 records that a floor of three
*modules* was removed for being wrong, while v7 and v8 ask for a lower band and
a floor of three *dates*.

Provenance is unaffected. `readPromptVersion` parses the `# Orchestrator prompt
— vN` heading, which stays in the prompt file, and the composition cache keys on
the prompt's full text — so this move invalidated the cache once, as any edit
does.

Keep appending here, newest first, when the prompt version changes.

---

**v14 (2026-09-15):** Hard requirements moved into the numbered rules, and the
band below the hero became one of them. Five v13 runs came back with three pages
that were hero-and-rail only. Two of those chose it deliberately — the reasoning
on the St. Paul brief says a lower band "would only tempt travel he's already
ruled out" — and the Atlanta run did write a third section, an un-headed
full-tour list with `group_by_geo: true`, which the validator dropped.

That last one is the reason this is a placement change rather than an
explanation. The prompt already told the model the page owns the full tour list
("You do not place this and cannot remove it") and already told it an un-headed
repeat is dropped. Both were ignored. Rule 5 — "do not place `event_header`" —
says the same class of thing in the numbered list, and was obeyed. Same file,
same instruction, followed where it was a rule and not where it was prose. So
the shell fact and the heading requirement became rules 5 and 6, and the lower
band became rule 7, rather than being said again more firmly.

The band also got a licence it did not have: it is orientation, not a second set
of options, so it may show dates the visitor ruled out provided its heading says
so. Without that, the requirement is unsatisfiable exactly where the thin pages
came from — the St. Paul brief had one date in the whole snapshot matching his
constraints.

`headline` is gone: `spec.headline` printed a third line under the tour name and
subtitle in `event_header`, which was redundant framing above a page whose
sections already carry their own headings. Removed from the contract, the
component, `ModuleComponentProps`, the renderer and the prompt's output block.

Three war stories left for this file (the `prod-043` hero, the Vegas rank claim,
the `"]` reasoning array). The rules they were attached to stayed; the incidents
were addressed to us, not to the model reading them.

`ValidationNote` gained a fourth level, `gap` — a rule the validator reports
because it cannot repair it. It fires when a page comes out with one
`production_list`, and it names the drop when a drop is what caused it. Writing
the missing section is the orchestrator's job; the alternative to a note is a
page that looks finished because nothing was dropped to make it thin.

**v13 (2026-09-14):** `top_pick` moved out of the spec and into the hero
section's props. The Texas custom brief recommended prod-026 (Las Vegas) and
wrote "the most in-demand night in your top group" about it — while the hero its
own filter selected was prod-043, prod-028 and prod-044 at demand 0.99, 0.98 and
0.97 against Vegas at 0.96. The pick rendered in the third section instead, and
the reasoning described a hero of "Madison Square Garden, LA's Crypto.com run,
and Las Vegas" that the page never showed: two of those three were right, the
third was a second Madison Square Garden night. The cause is structural rather
than a lapse — the model writes the filter and the prose in one pass and never
sees the rows, so a page-level pick was a claim with no section to be wrong
about. Authored on the hero, a pick outside the recommendation band has nowhere
to live, and "one per page" still holds for free because `maxHero` is 1 and a
second hero is demoted before the pick is read.

**v12 (2026-09-14):** `visitor_metro` — the composition states where the visitor
is, and the renderer uses it. `selectProductions` grouped dates against
`context.geo.metro` and the section header printed it, so the geo-IP guess was
the only location the page could express, even though `buildMessage` tells the
model the description outranks it. The first open-ended custom brief — an LA
visitor against the Chicago fixture — composed correctly by setting
`group_by_geo: false` on all three modules, which is the model bending its
composition around a rendering limit rather than a decision anyone asked for.
Set `group_by_geo: true` with that brief and the heading read "Near Chicago". A
system that only works while the model keeps choosing to sidestep the question
is not working.

**v11 (2026-09-14):** superlatives in `top_pick_reason` must be scoped to what
the page shows. The first trimmed v10 run wrote "the most in-demand date you can
reach without flying" about a Chicago date at demand 0.90 — while prod-038, also
Chicago and so equally reachable, sits at 0.93. Every number in the sentence came
from the snapshot, so the anti-fabrication line did not catch it: the model meant
"most in-demand I can reach *and afford*" and compressed it into a claim about
all 52 dates that happens to be false. "The most in-demand of these" is true by
construction.

**v10 (2026-09-14):** `top_pick_reason` is addressed to the visitor. The first
v9 run wrote "the highest-demand date **she** can get to without flying" — the
model mirroring the brief's grammar, which describes the visitor in the third
person because it was written about them for us. Every other visitor-facing
string on the page either addresses nobody or says "your".

**v9 (2026-09-14):** `top_pick_reason` — the page's one recommendation now says
why, on hover. The *why* has lived in `reasoning`, which only we read, so a
visitor got a pink outline and fixed copy and no argument. This is the first
model-written prose a visitor sees, and unlike a heading it states facts, which
is why the anti-fabrication line is there and the length bounds are hard.

**v8 (2026-09-11):** the top band gets a floor of three, and an approximate
limit is read as approximate. The v7 hero was a single date — the only Chicago
show under $80 — because `max_price: 80` was applied to a brief that said "about
$80", discarding the $89 date nine dollars over. A page whose job is
recommendations cannot open with one. The count belongs to the page shape; the
approximation belongs to the constraint section, so the two do not argue.

**v7 (2026-09-11):** the lower bands got a purpose — *sense-making* the
inventory the top group left out — and rule 1 lost the clause that let the model
skip them. One v6 run stopped at a single section and quoted that clause back as
its reason. Stated as the band's purpose rather than as a floor: the floor is
what failed in v6.

**v6 (2026-09-10):** rules 1, 6 and 7 became "The shape of the page". They were
three separate answers — a count, a constraint and a minimum — to a question
nobody had written down, and the model resolved the tension between them by
quietly dropping the count. The arc says the same things as one idea, and drops
the floor of three modules: a page of one good section plus the rail card is
better than three padded ones. Item counts are now capped by prominence in code
(hero 3, others 7) rather than asked for here.

**v5 (2026-09-10):** `top_pick` replaces the `highlight` strategy. The page may
name one date it recommends and the card labels it; naming a strategy keyword and
letting code pick the winning row was a rule dressed as a recommendation. It is a
page-level field, so "one per page" needs no rule.

**v4 (2026-09-10):** a second placeable module — `market_signals`, the rail
card, whose title is fixed and whose stats are selected. The catalog carries its own `region` line, so nothing here asks you to
decide placement. See "The rail is context, not the argument". Composition rule
6 states the no-overlap constraint the renderer already enforced silently: the
first v4 run wrote a second section that was a re-cut of the first section's
dates, and it rendered as nothing. Rule 7 followed from the next run, which
obeyed rule 6 by giving each section its own city and produced three sections of
one and two dates. Both are judgments about what serves a visitor rather than
things that make a page *wrong*, which is why they are here and not in the
validator — see docs/COMPOSABILITY.md.

**v3 (2026-09-03):** geography named as a lever you can reason about — see
"Distance is yours to judge". No schema change; the cities were always there.

**v2 (2026-09-03):** the market snapshot gained per-date demand, sales-velocity,
and value signals, and the context gained an `experience_first` intent. The
"Signals available" section below is the material change over v1.
