import React from 'react'

import type { BoxProps as MuiBoxProps } from '@mui/material/Box'
import MuiBox from '@mui/material/Box'

/**
 * Ported verbatim from vivid-web-athena `src/design-system/components/box`.
 *
 * The `flexShrink = 0` default is the reason this wrapper exists rather than
 * using MUI's Box directly — keeping it means ported layout code behaves the
 * same here as it does there.
 */
interface CustomBoxProps extends MuiBoxProps {
    flexShrink?: MuiBoxProps['flexShrink']
}

const Box = React.forwardRef<unknown, CustomBoxProps>(({ flexShrink = 0, ...props }: CustomBoxProps, ref) => (
    <MuiBox ref={ref} flexShrink={flexShrink} {...props} />
))

Box.displayName = 'Box'

export default Box

export type BoxProps = MuiBoxProps
