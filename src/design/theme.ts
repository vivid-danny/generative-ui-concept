import { createTheme } from '@mui/material/styles'
import type { TypographyStyleOptions } from '@mui/material/styles/createTypography'

import * as semantic from './tokens/semantic-colors/tokens'
import { FONT_FAMILY, TYPE_STYLES, type TypeScaleKey } from './typography'

/**
 * The prototype's MUI theme. Palette values come from athena's committed
 * semantic-colour tokens; typography comes from the Figma type scale. Nothing
 * here is hand-picked.
 *
 * Only what the slice needs is wired up — this is deliberately much smaller than
 * athena's theme, which also carries four brands and a large component override
 * layer.
 */

/**
 * Token colours are 8-digit #RRGGBBAA. Fully-opaque values are trimmed to 6
 * digits for readability in devtools; genuinely translucent ones are converted to
 * rgba(), which every browser accepts in every colour property.
 */
function toCssColor(token: string): string {
    if (!/^#[0-9a-fA-F]{8}$/.test(token)) return token

    const [r, g, b, a] = [1, 3, 5, 7].map((i) => parseInt(token.slice(i, i + 2), 16))
    if (a === 255) return `#${token.slice(1, 7)}`
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

/** Every semantic token, ready to use, with the alpha handling already done. */
export const color = Object.fromEntries(
    Object.entries(semantic).map(([name, value]) => [name, toCssColor(value as string)]),
) as Record<keyof typeof semantic, string>

// Register the DS type scale as MUI Typography variants, and switch off the
// MUI defaults we are not using, so `variant` only ever offers real DS names.
declare module '@mui/material/styles' {
    interface TypographyVariants extends Record<TypeScaleKey, TypographyStyleOptions> {}
    interface TypographyVariantsOptions extends Partial<
        Record<TypeScaleKey, TypographyStyleOptions>
    > {}
}

declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides
        extends
            Record<TypeScaleKey, true>,
            Record<
                | 'h1'
                | 'h2'
                | 'h3'
                | 'h4'
                | 'h5'
                | 'h6'
                | 'subtitle1'
                | 'subtitle2'
                | 'body1'
                | 'body2'
                | 'button',
                false
            > {}
}

/** Which HTML element each DS variant renders as by default. */
const VARIANT_ELEMENT: Partial<Record<TypeScaleKey, string>> = {
    titleXxl: 'h1',
    titleXl: 'h2',
    titleLg: 'h3',
    titleMd: 'h4',
    titleSm: 'h5',
    subtitleXxl: 'p',
    subtitleXl: 'p',
    subtitleLg: 'p',
    subtitleMd: 'p',
    subtitleSm: 'p',
    body: 'p',
    bodyBold: 'p',
    small: 'p',
    smallMedium: 'p',
    smallBold: 'p',
    caption: 'span',
    captionMedium: 'span',
    overline: 'span',
    footnote: 'span',
}

export const theme = createTheme({
    cssVariables: true,
    palette: {
        primary: {
            main: color.PrimaryMain,
            light: color.PrimaryLight,
            dark: color.PrimaryDark,
            contrastText: color.PrimaryContrast,
        },
        secondary: {
            main: color.SecondaryMain,
            light: color.SecondaryLight,
            dark: color.SecondaryDark,
            contrastText: color.SecondaryContrast,
        },
        error: {
            main: color.StatusErrorMain,
            light: color.StatusErrorLight,
            dark: color.StatusErrorDark,
        },
        warning: {
            main: color.StatusWarningMain,
            light: color.StatusWarningLight,
            dark: color.StatusWarningDark,
        },
        info: {
            main: color.StatusInfoMain,
            light: color.StatusInfoLight,
            dark: color.StatusInfoDark,
        },
        success: {
            main: color.StatusSuccessMain,
            light: color.StatusSuccessLight,
            dark: color.StatusSuccessDark,
        },
        text: {
            primary: color.TextPrimary,
            secondary: color.TextSecondary,
            disabled: color.TextDisabled,
        },
        divider: color.SurfaceDivider,
        background: {
            default: color.BackgroundDefault,
            paper: color.SurfaceWhite,
        },
    },
    shape: {
        // --radius-md, the DS default for cards and inputs.
        borderRadius: 8,
    },
    typography: {
        fontFamily: FONT_FAMILY,
        // `src/design/typography.ts` is deliberately framework-free — it is the
        // Figma type scale as data. MUI's TypographyOptions wants its built-in
        // variant keys (caption, overline) typed as its own CSSProperties, so the
        // adaptation happens here, at the boundary, rather than polluting the
        // design data with a MUI dependency.
        ...(TYPE_STYLES as Record<TypeScaleKey, TypographyStyleOptions>),
    },
    components: {
        MuiTypography: {
            defaultProps: {
                variant: 'body',
                variantMapping: VARIANT_ELEMENT,
            },
        },
    },
})

export default theme
