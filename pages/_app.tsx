import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import Head from 'next/head'

import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter'

import theme from '@/design/theme'

// Design tokens, copied verbatim from vivid-web-athena. Imported as global CSS
// so the custom properties are available to both MUI and the ported .module.scss
// files, exactly as they are in athena.
import '@/design/tokens/primitive-colors/variables.css'
import '@/design/tokens/semantic-colors/variables.css'
import '@/design/tokens/layout-tokens/variables.css'
import '@/design/globals.scss'

// Agentation — a visual feedback tool for AI coding agents (click an element, add a
// note, copy structured markdown). Dev-only: the NODE_ENV check is statically replaced
// at build time so the import is dead-code-eliminated from production builds.
const Agentation =
    process.env.NODE_ENV === 'development'
        ? dynamic(() => import('agentation').then((m) => m.Agentation), { ssr: false })
        : () => null

export default function App({ Component, pageProps, ...rest }: AppProps) {
    return (
        <AppCacheProvider {...rest}>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/favicon.png" />
                <title>Generative UI — performer page</title>
            </Head>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Component {...pageProps} />
                <Agentation />
            </ThemeProvider>
        </AppCacheProvider>
    )
}
