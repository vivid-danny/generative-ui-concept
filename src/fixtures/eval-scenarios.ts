/**
 * Scripted briefs for the Eval mode.
 *
 * The point of an eval scenario is to exercise several decision levers at once,
 * so a single composition tells you whether the orchestrator can weigh them
 * against each other rather than answering only the one it was handed. Written
 * as prose because that is what the presenter will type in front of a room, and
 * because a brief that reads naturally is a fairer test of the prompt than a
 * list of structured fields.
 *
 * These are deliberately thin for now — the mechanism matters this slice, the
 * content gets iterated next. When adding one, name the levers it touches so it
 * is obvious what a bad composition would be failing at.
 */

export interface EvalScenario {
    slug: string
    label: string
    /** Which decision levers this brief is meant to put in tension. */
    levers: string
    /** The brief, as it would be typed. */
    brief: string
}

export const EVAL_SCENARIOS: EvalScenario[] = [
    {
        slug: 'budget-distance-popularity',
        label: 'Budget vs. distance vs. the big night',
        levers: 'price · location · popularity · date',
        brief: [
            "She's in Chicago and can spend about $80 a ticket.",
            'She would rather see a packed, high-energy show than get the cheapest seat —',
            'the kind of night where the room is full and everyone knows the words —',
            'and she keeps checking whether the big dates are going to sell out before she decides.',
            'She can drive a few hours on a weekend but not fly.',
            'The onsale is a couple of hours old.',
        ].join(' '),
    },
]

export const DEFAULT_EVAL_SCENARIO = EVAL_SCENARIOS[0]

export function evalScenarioBySlug(slug: string | undefined): EvalScenario {
    return EVAL_SCENARIOS.find((scenario) => scenario.slug === slug) ?? DEFAULT_EVAL_SCENARIO
}
