import { z } from 'zod'

/**
 * Market data schema — source plan §3.2.
 *
 * The snapshot the page is composed *from*. Per §3.2 the listings and prices are
 * real; the derived fields are computed or plausibly fabricated, and each one is
 * marked below so nobody later mistakes a fabricated signal for a measured one.
 * That distinction is load-bearing: three of the planned modules
 * (`sellout_urgency`, `price_trend`, `view_from_seat_value`) read entirely from
 * derived fields.
 */

export const SelloutRiskSchema = z.enum(['low', 'moderate', 'high'])

export const InventoryByTierSchema = z.object({
    lower: z.number().int().nonnegative(),
    upper: z.number().int().nonnegative(),
    floor: z.number().int().nonnegative(),
})

export const ProductionSchema = z.object({
    id: z.string().min(1),
    /** ISO 8601 local datetime, e.g. "2026-07-18T19:30:00". */
    date: z.string().min(1),
    venue: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    listing_count: z.number().int().nonnegative(),
    /** Real: the lowest all-in price in the snapshot. */
    floor_price: z.number().positive(),
    /** Real: the median all-in price in the snapshot. */
    median_price: z.number().positive(),
    /** DERIVED — fabricated. Inventory-velocity read, not a measured figure. */
    sellout_risk: SelloutRiskSchema,
    /** DERIVED — fabricated. Fractional 7-day change, e.g. -0.04 = down 4%. */
    price_trend_7d: z.number(),
    inventory_by_tier: InventoryByTierSchema,
    /**
     * DERIVED — fabricated. 0..1 fan anticipation / popularity for this date,
     * independent of price and inventory. The "biggest crowd / most anticipated"
     * axis — carried over from the earlier event-decision prototype's `demand`.
     */
    demand_score: z.number().min(0).max(1),
    /**
     * DERIVED — fabricated. 0..1 rate inventory is moving, a continuous signal
     * finer than `sellout_risk`. The "selling fast" axis (prototype `salesVelocity`).
     */
    sales_velocity: z.number().min(0).max(1),
    /**
     * DERIVED — fabricated. 0..1 price-for-demand value at the date level (higher
     * is better value). The prototype's "best-deal" blend, stored as its own signal
     * rather than computed, so modules and the orchestrator read it directly.
     */
    value_score: z.number().min(0).max(1),
    /**
     * DERIVED — fabricated. People who looked at this date in the last day.
     *
     * A real count rather than a score, because the badge it feeds says "20 Fans
     * Viewed" — a number on screen has to be a number in the data, or the card
     * would be inventing one at render time.
     */
    fans_viewed_24h: z.number().int().nonnegative(),
    /**
     * DERIVED — fabricated. Days since this date was announced.
     *
     * Per production rather than per visit: a tour's dates are not all announced
     * at once, and added dates are exactly what "Newly Released" is for. Taking
     * it from the visitor's `onsale_hours_ago` instead would mark every card
     * newly released, which is both redundant and less true.
     */
    announced_days_ago: z.number().int().nonnegative(),
})

export const ListingSchema = z.object({
    id: z.string().min(1),
    section: z.string().min(1),
    row: z.string().min(1),
    /** Real: all-in price per ticket. */
    price: z.number().positive(),
    quantity_available: z.number().int().positive(),
    /** DERIVED — fabricated. 0..1, higher is a better view. */
    view_score: z.number().min(0).max(1),
    /** DERIVED — fabricated. 0..1, higher is better value for the view. */
    deal_score: z.number().min(0).max(1),
})

export const MarketSchema = z.object({
    performer: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        /** Performer art. A local /public path — assets are committed, not fetched. */
        image_url: z.union([z.string().url(), z.string().startsWith('/')]),
        category: z.string().min(1),
        /** Current tour name, shown as the header subtitle when present. */
        tour_name: z.string().min(1).optional(),
    }),
    productions: z.array(ProductionSchema).min(1),
    listings_sample: z.array(ListingSchema),
    /** When the snapshot was taken. The demo narrates this date — §9. */
    captured_at: z.string().min(1),
})

export type Market = z.infer<typeof MarketSchema>
export type Production = z.infer<typeof ProductionSchema>
export type Listing = z.infer<typeof ListingSchema>
export type SelloutRisk = z.infer<typeof SelloutRiskSchema>
