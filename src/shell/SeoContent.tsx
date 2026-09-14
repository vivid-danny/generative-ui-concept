import React from 'react'

import Typography from '@/design-system/typography'
import Breadcrumbs from '@/shell/Breadcrumbs'
import type { Market } from '@/contracts/market'

import styles from './SeoContent.module.scss'

/**
 * SEO content block — Figma `SEO` frame (17055:179014). Full-bleed section below
 * the listings: breadcrumb, an about paragraph, a how-to-buy paragraph, and the
 * full tour-date table. Everything is derived from the market snapshot rather
 * than authored, so it stays correct as the data changes.
 */

const TABLE_DATE = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

export const SeoContent: React.FC<{ market: Market }> = ({ market }) => {
    const { performer, productions } = market

    const byDate = [...productions].sort((a, b) => a.date.localeCompare(b.date))
    const cities = new Set(productions.map((production) => production.city)).size
    const floors = productions.map((production) => production.floor_price)
    const minPrice = Math.min(...floors)
    const maxPrice = Math.max(...floors)
    const first = MONTH_YEAR.format(new Date(byDate[0].date))
    const last = MONTH_YEAR.format(new Date(byDate[byDate.length - 1].date))
    const run = first === last ? first : `${first} – ${last}`
    const tour = performer.tour_name ? `the ${performer.tour_name}` : 'the current tour'

    return (
        <section className={styles.seo} aria-label={`About ${performer.name}`}>
            <div className={styles.inner}>
                <div className={styles.group}>
                    <Breadcrumbs
                        className={styles.breadcrumb}
                        variant="body"
                        items={['Concerts', performer.category]}
                    />
                    <Typography variant="titleMd" component="h2">
                        About {performer.name}
                    </Typography>
                    <Typography variant="body" component="p" className={styles.body}>
                        {performer.name} tickets are available now on Vivid Seats for {tour}. The{' '}
                        {performer.category.toLowerCase()} act is playing {productions.length} shows across{' '}
                        {cities} {cities === 1 ? 'city' : 'cities'} this run ({run}), with get-in prices
                        starting at ${minPrice}. Every order is backed by the 100% Buyer Guarantee.
                    </Typography>
                </div>

                <div className={styles.group}>
                    <Typography variant="titleMd" component="h2">
                        How to buy {performer.name} tickets
                    </Typography>
                    <Typography variant="body" component="p" className={styles.body}>
                        Browse every {performer.name} date above, filter by your budget, and pick the seats
                        that fit. Prices on this tour range from ${minPrice} to ${maxPrice} all-in, so you can
                        compare {productions.length} dates side by side — whether you want the lowest get-in
                        price or a specific section. Select a show to see the full seat map and check out in a
                        few clicks.
                    </Typography>
                </div>

                <div className={styles.group}>
                    <Typography variant="titleMd" component="h2">
                        {performer.name} Tour Dates and Ticket Prices
                    </Typography>
                    <Typography variant="body" component="p" className={styles.body}>
                        All {performer.name} tour dates and average ticket prices, from the current listings.
                    </Typography>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col">Date</th>
                                <th scope="col">City</th>
                                <th scope="col">Venue</th>
                                <th scope="col" className={styles.priceCol}>
                                    AVG Price
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {byDate.map((production) => (
                                <tr key={production.id}>
                                    <td>{TABLE_DATE.format(new Date(production.date))}</td>
                                    <td>
                                        {production.city}, {production.state}
                                    </td>
                                    <td>{production.venue}</td>
                                    <td className={styles.priceCol}>${production.median_price}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

export default SeoContent
