/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Commented out for dev mode - Cloudflare Pages uses @cloudflare/next-on-pages
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'en.onepiece-cardgame.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'optcgapi.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'onepiece.limitlesstcg.com',
        pathname: '/**',
      },
    ],
    unoptimized: true // Cloudflare Pages: Images are served via CDN
  },
  // Cloudflare Pages: Note - Only specific routes use edge runtime (see route.ts files)
  // Cloudflare Pages: Ensure proper headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Accept',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
