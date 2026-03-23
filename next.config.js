/** @type {import('next').NextConfig} */
const nextConfig = {
  // Paralel SSG worker yarışında bazen MODULE_NOT_FOUND; 1 güvenli.
  experimental: {
    staticGenerationMaxConcurrency: 1,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "optcgapi.com", pathname: "/**" },
      { protocol: "https", hostname: "en.onepiece-cardgame.com", pathname: "/images/**" },
      { protocol: "https", hostname: "onepiece.limitlesstcg.com", pathname: "/**" },
      { protocol: "https", hostname: "limitlesstcg.nyc3.digitaloceanspaces.com" },
      { protocol: "https", hostname: "egmanevents.com" },
      { protocol: "https", hostname: "deckbuilder.egmanevents.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Accept, Authorization",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    // ÖNEMLİ: fs:false yalnızca istemci — sunucuda fs yoksa getSummary/readFileSync → 500
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
      };
    }
    return config;
  },
};

// Varsayılan `next dev`: vm patch'i Webpack chunk yüklemesini bozabiliyor (örn. Cannot find module './873.js').
// Cloudflare binding'leriyle `next dev` için: OPENNEXT_CLOUDFLARE_DEV=1 npm run dev
if (
  process.env.NODE_ENV === "development" &&
  process.env.OPENNEXT_CLOUDFLARE_DEV === "1"
) {
  void import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev(),
  );
}

module.exports = nextConfig;
