/**
 * The VS Web Design System type scale, from Figma file QITaTxYPUrqmzzB6NVayVu,
 * node 18623:1780. Every value below is the Figma value verbatim — px sizes and
 * px line-heights — so this file can be diffed against the design source.
 *
 * Sizes are emitted as rem so type tracks the reader's font-size preference
 * (WCAG 1.4.4); line-heights are emitted unitless. That mirrors the reasoning in
 * athena's build-scripts/sync-tokens.ts, which converts token lengths to rem for
 * the same reason.
 */

export const FONT_FAMILY = "'GT Walsheim', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

/** The DS declares Black as 800, not 900. See fonts.scss. */
export const FONT_WEIGHT = {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 800,
} as const

const ROOT_FONT_SIZE_PX = 16

interface TypeStyleSpec {
    /** Figma `size`, in px. */
    readonly size: number
    /** Figma `lineHeight`, in px. */
    readonly lineHeight: number
    readonly weight: number
    /**
     * Figma reports this as a bare `10` for Overline. Interpreted as percent —
     * 10px of tracking on 12px type would be absurd — hence `em` below.
     */
    readonly letterSpacingPercent?: number
}

/** Figma style name -> spec. Keys are the names as they appear in Figma. */
export const TYPE_SCALE = {
    titleXxl: { size: 40, lineHeight: 50, weight: FONT_WEIGHT.black },
    titleXl: { size: 32, lineHeight: 40, weight: FONT_WEIGHT.black },
    titleLg: { size: 24, lineHeight: 30, weight: FONT_WEIGHT.black },
    titleMd: { size: 20, lineHeight: 25, weight: FONT_WEIGHT.bold },
    titleSm: { size: 18, lineHeight: 22.5, weight: FONT_WEIGHT.bold },

    subtitleXxl: { size: 32, lineHeight: 40, weight: FONT_WEIGHT.regular },
    subtitleXl: { size: 24, lineHeight: 30, weight: FONT_WEIGHT.regular },
    subtitleLg: { size: 20, lineHeight: 25, weight: FONT_WEIGHT.regular },
    subtitleMd: { size: 18, lineHeight: 22, weight: FONT_WEIGHT.regular },
    subtitleSm: { size: 16, lineHeight: 20, weight: FONT_WEIGHT.regular },

    body: { size: 16, lineHeight: 24, weight: FONT_WEIGHT.regular },
    small: { size: 14, lineHeight: 21, weight: FONT_WEIGHT.regular },
    caption: { size: 12, lineHeight: 18, weight: FONT_WEIGHT.regular },

    // Weight variants of the above. These are not in the type-scale frame
    // (18623:1780) but are bound to real nodes on the performer page, so they
    // are part of the system in practice.
    //
    // Note: the design system also declares `Body/Medium/Text`, but reports it
    // with weight 400 — identical to `body`. That looks like an authoring slip
    // rather than an intended style, so it is deliberately not modelled here;
    // adding it would mean guessing which of the name and the weight is right.
    bodyBold: { size: 16, lineHeight: 24, weight: FONT_WEIGHT.bold },
    smallMedium: { size: 14, lineHeight: 21, weight: FONT_WEIGHT.medium },
    smallBold: { size: 14, lineHeight: 21, weight: FONT_WEIGHT.bold },
    captionMedium: { size: 12, lineHeight: 18, weight: FONT_WEIGHT.medium },
    overline: { size: 12, lineHeight: 15, weight: FONT_WEIGHT.bold, letterSpacingPercent: 10 },
    footnote: { size: 10, lineHeight: 15, weight: FONT_WEIGHT.regular },
} as const satisfies Record<string, TypeStyleSpec>

export type TypeScaleKey = keyof typeof TYPE_SCALE

export interface CssTypeStyle {
    fontFamily: string
    fontSize: string
    fontWeight: number
    lineHeight: number
    letterSpacing?: string
}

/** Converts one Figma spec into the CSS properties MUI's theme expects. */
export function toCssTypeStyle(spec: TypeStyleSpec): CssTypeStyle {
    return {
        fontFamily: FONT_FAMILY,
        fontSize: `${spec.size / ROOT_FONT_SIZE_PX}rem`,
        fontWeight: spec.weight,
        lineHeight: spec.lineHeight / spec.size,
        ...(spec.letterSpacingPercent
            ? { letterSpacing: `${spec.letterSpacingPercent / 100}em` }
            : {}),
    }
}

export const TYPE_STYLES = Object.fromEntries(
    Object.entries(TYPE_SCALE).map(([name, spec]) => [name, toCssTypeStyle(spec)]),
) as Record<TypeScaleKey, CssTypeStyle>
