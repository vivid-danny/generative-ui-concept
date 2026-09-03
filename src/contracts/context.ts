import { z } from 'zod'

/**
 * Context schema — source plan §3.1.
 *
 * Everything the orchestrator is told about *who is landing*. Kept strictly
 * separate from market data (§3.2): context is about the visitor, market is
 * about the inventory, and the whole premise is that the same market produces
 * different pages for different contexts.
 */

export const EntrySourceSchema = z.enum([
    'paid_search',
    'organic_search',
    'paid_social',
    'direct',
    'email',
    'internal_nav',
])

export const InferredIntentSchema = z.enum([
    'price_sensitive',
    'date_flexible',
    'seat_quality_first',
    'location_flexible',
    'gift_buyer',
    'unknown',
])

export const DeviceSchema = z.enum(['mobile', 'desktop', 'tablet'])

/**
 * Session signals stay empty through slice 1 and Stage 3; Stage 4 appends
 * behavioural events here and re-orchestrates. Modelled as a discriminated union
 * now so adding an event type later is additive rather than a schema change.
 */
export const SessionSignalSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('sort_by_price') }),
    z.object({ type: z.literal('viewed_date'), date: z.string() }),
    z.object({ type: z.literal('dwell_map_seconds'), value: z.number().nonnegative() }),
    z.object({ type: z.literal('budget_changed'), value: z.number().positive() }),
])

export const ContextSchema = z.object({
    persona_id: z.string().min(1),
    entry: z.object({
        source: EntrySourceSchema,
        query: z.string().nullable(),
        inferred_intent: InferredIntentSchema,
    }),
    device: DeviceSchema,
    geo: z.object({
        metro: z.string(),
        distance_to_venue_mi: z.number().nonnegative(),
    }),
    timing: z.object({
        onsale_hours_ago: z.number().nonnegative().nullable(),
        event_days_out: z.number().int(),
    }),
    returning_visitor: z.boolean(),
    session_signals: z.array(SessionSignalSchema).default([]),
    /**
     * Free-form budget ceiling in dollars, when the visitor has stated one.
     * Not in the §3.1 sketch, but the MVP's one interaction (`budget_entry`)
     * needs somewhere to put its value, and it belongs to the visitor.
     */
    stated_budget: z.number().positive().nullable().default(null),
})

export type Context = z.infer<typeof ContextSchema>
export type SessionSignal = z.infer<typeof SessionSignalSchema>
export type EntrySource = z.infer<typeof EntrySourceSchema>
export type InferredIntent = z.infer<typeof InferredIntentSchema>
