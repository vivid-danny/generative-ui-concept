/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    sassOptions: {
        // Lets `.module.scss` files ported from vivid-web-athena resolve their
        // token imports the same way they do there.
        includePaths: ['./src/design'],
    },
    // No `images.remotePatterns` on purpose. Every asset the prototype needs is
    // committed under /public — fonts and performer art included — so it runs
    // with no network dependency on vividseats.com or any CDN.
}

module.exports = nextConfig
