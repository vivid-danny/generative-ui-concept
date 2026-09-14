/**
 * Page grid constants, measured from the Performer Page Figma file
 * (fileKey d48AxLOJnqPC4Wb5gQhJGF).
 *
 * These are layout facts from the design, not invented values — each is
 * annotated with the Figma node it came from so it can be re-checked.
 */

/** `screen-xl` — node 17055:178919, 1440 wide. */
export const DESKTOP = {
    /** Design frame width. Not a max-width — see CONTENT_MAX_WIDTH. */
    frameWidth: 1440,
    /** `<navbar>` 17055:178920 */
    navbarHeight: 118,
    /** `header` 17055:178925 */
    headerHeight: 240,
    /** `Footer` 17055:179082 */
    footerHeight: 408,
    /** Left/right page margin: container starts at x=120, rightCol ends at 1320. */
    pageMargin: 120,
    /** `container` 17055:178924 — the composed/main column. */
    mainColumnWidth: 812,
    /** 980 (rightCol x) - 932 (container right edge) */
    columnGap: 48,
    /** `rightCol` 17055:178973 */
    railWidth: 340,
} as const

/** 120 + 812 + 48 + 340 = 1320; 1440 - 1320 = 120. The grid closes. */
export const CONTENT_MAX_WIDTH = DESKTOP.mainColumnWidth + DESKTOP.columnGap + DESKTOP.railWidth

/** `screen-sm` — node 17055:179204, 375 wide. */
export const MOBILE = {
    frameWidth: 375,
    /** `<navigation>` 17055:179205 */
    navHeight: 92,
    /** `Image Component` 17144:60805 */
    heroImageHeight: 145,
    /** `<Performer Header>` 17055:179206 — pageTitle 88 + ctaGroup 37 */
    headerHeight: 125,
    pageMargin: 16,
} as const

/** Component heights that recur inside the main column. */
export const ROW = {
    /** `<Production Card>` 17055:178943 */
    productionCardHeight: 88,
    /** Cards sit at y=0 and y=96 within productionList -> 8px gap. */
    productionCardGap: 8,
    /** `<Tab Collection>` 17055:178932 */
    tabCollectionHeight: 49,
    /** `<Performer Filters>` 17055:178933 */
    filterBarHeight: 40,
    /** `geoListGroup > header` 17055:178935 */
    listGroupHeaderHeight: 24,
} as const

/**
 * The single breakpoint this slice needs: below it, the rail drops and the page
 * becomes the `screen-sm` layout. Set at the point the desktop grid stops
 * fitting (1200 content + 2x24 minimum margin).
 */
export const DESKTOP_MIN_WIDTH = 1248
