import React from 'react'

/**
 * The Vivid Seats logo, served from `/public`. `primary` is the dark mark +
 * wordmark for light surfaces (the navbar); `contrast` is the white wordmark for
 * dark surfaces (the footer). `width` sizes it; height follows the SVG's ratio.
 */
const SOURCES = {
    primary: '/vslogo.svg',
    contrast: '/vslogo-white.svg',
} as const

export const Logo: React.FC<{ width?: number; variant?: keyof typeof SOURCES }> = ({
    width = 152,
    variant = 'primary',
}) => <img src={SOURCES[variant]} alt="Vivid Seats" width={width} />

export default Logo
