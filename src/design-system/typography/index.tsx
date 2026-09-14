import React from 'react'

import type { TypographyProps as MuiTypographyProps } from '@mui/material/Typography'
import MuiTypography from '@mui/material/Typography'

/**
 * Ported from vivid-web-athena `src/design-system/components/typography`, with
 * the translation layer removed — athena's version calls `t(label || children)`
 * through `useTranslations()`, which requires an i18n provider. i18n is out of
 * scope for the prototype, so children render directly.
 *
 * The `variant` values come from the DS type scale registered in
 * `src/design/theme.ts` (titleXxl, subtitleLg, body, …), not MUI's defaults.
 */
export interface TypographyProps extends MuiTypographyProps {
    /** Explicit element override, matching athena's prop name. */
    readonly as?: React.ElementType
}

export const Typography: React.FC<TypographyProps> = ({ as, children, ...props }) => (
    <MuiTypography component={as ?? undefined} {...props}>
        {children}
    </MuiTypography>
)

export default Typography
