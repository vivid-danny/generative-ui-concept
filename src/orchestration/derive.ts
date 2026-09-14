/**
 * Derived date signals — computed from a production's `date`, not stored on it.
 *
 * These are the "weekend vs weeknight" and "how far out" levers the earlier
 * event-decision prototype carried on each event (`isWeekend`, `isWeeknight`).
 * We derive rather than store them so the fixture stays a snapshot of inventory,
 * not of the calendar.
 *
 * Timezone landmine (see docs/HANDOFF.md): fixture dates are venue-local
 * wall-clock strings with no offset ("2026-12-05T19:30:00"). Parsing them into a
 * `Date` and reading UTC fields shifts the day. So we read the day-of-week and
 * the calendar day off the local components of the parsed date, the same way
 * `ProductionCard` and `summarize` format them — never `getUTC*`.
 */

/** Days of the week that count as the weekend for tour-date purposes: Fri–Sun. */
const WEEKEND_DAYS = new Set([5, 6, 0]) // Fri=5, Sat=6, Sun=0

/** Local day-of-week (0=Sun..6=Sat) for a venue-local wall-clock date string. */
function localDayOfWeek(date: string): number {
    // `new Date("YYYY-MM-DDTHH:mm:ss")` (no offset) is parsed as local time, so
    // `getDay()` reads the intended venue-local weekday. This matches how the
    // card renders the date and avoids the UTC day-shift.
    return new Date(date).getDay()
}

/** Fri, Sat, or Sun. */
export function isWeekend(date: string): boolean {
    return WEEKEND_DAYS.has(localDayOfWeek(date))
}

/** Mon–Thu — the complement of {@link isWeekend}. */
export function isWeeknight(date: string): boolean {
    return !isWeekend(date)
}

/**
 * Whole days from the snapshot's capture date to the event date. Both are read
 * at calendar-day granularity (midnight local) so the count is stable regardless
 * of the wall-clock time on either string. Past events return a negative number.
 */
export function daysOut(date: string, capturedAt: string): number {
    const event = startOfLocalDay(date)
    const captured = startOfLocalDay(capturedAt)
    return Math.round((event.getTime() - captured.getTime()) / 86_400_000)
}

/**
 * Midnight-local of a date or datetime string, ignoring any time component.
 * Reads the Y-M-D straight off the string rather than via `new Date(value)` —
 * a date-only string ("2026-09-02") parses as UTC while a datetime string
 * ("2026-09-02T20:00:00") parses as local, so routing both through the parser
 * would put them on different calendar days. Slicing the components sidesteps
 * that entirely.
 */
function startOfLocalDay(value: string): Date {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
}
