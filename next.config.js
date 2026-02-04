/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages: Do NOT use static export - use @cloudflare/next-on-pages instead
  // output: 'export', // Disabled for Cloudflare Pages
  
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
  
  // Cloudflare Pages: Ensure proper headers for API routes
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
            value: 'Content-Type, Accept, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
  
  // Cloudflare Pages: Optimize for Edge Runtime
  experimental: {
    // Ensure compatibility with Cloudflare Pages
  },
  
  // Cloudflare Pages: Webpack configuration (if needed)
  webpack: (config, { isServer }) => {
    // Cloudflare Pages: Ensure client-side code works correctly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
