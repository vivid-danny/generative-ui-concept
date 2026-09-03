import React from 'react'

import type { ChipOwnProps as MuiChipProps } from '@mui/material'
import { Chip as MuiChip } from '@mui/material'

/**
 * Ported verbatim from vivid-web-athena `src/design-system/components/chip`.
 */
export interface ChipProps extends MuiChipProps {
    className?: string
    rounded?: boolean
    leftIcon?: React.ReactElement<any>
    rightIcon?: React.ReactElement<any>
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

const Chip: React.FC<ChipProps> = ({ className, rounded, leftIcon, rightIcon, ...props }) => (
    <MuiChip
        sx={{ borderRadius: rounded ? '100px' : '4px' }}
        variant="outlined"
        className={className}
        clickable
        icon={leftIcon}
        deleteIcon={rightIcon}
        onDelete={rightIcon ? props.onClick : undefined}
        {...props}
    />
)

export default Chip
