import { Head, Html, Main, NextScript } from 'next/document'
import type { DocumentProps } from 'next/document'
import {
    documentGetInitialProps,
    DocumentHeadTags,
    type DocumentHeadTagsProps,
} from '@mui/material-nextjs/v15-pagesRouter'
import type { DocumentContext } from 'next/document'

export default function Document(props: DocumentProps & DocumentHeadTagsProps) {
    return (
        <Html lang="en">
            <Head>
                <DocumentHeadTags {...props} />
                {/*
                  Preload only the two faces above the fold (Black for the page
                  title, Regular for body). Preloading all four costs more than
                  it saves.
                */}
                <link rel="preload" href="/fonts/GT-Walsheim-Black.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
                <link rel="preload" href="/fonts/GT-Walsheim-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    )
}

Document.getInitialProps = async (ctx: DocumentContext) => {
    return await documentGetInitialProps(ctx)
}
