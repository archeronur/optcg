/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
    unoptimized: true
  },
}

module.exports = nextConfig
