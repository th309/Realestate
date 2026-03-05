/** @type {import('next').NextConfig} */
// Build cache buster: 2026-02-10-001
const nextConfig = {
  // Allow parallel dev instances (e.g., beta testing on port 3002)
  // Usage: NEXT_DIST_DIR=.next-test npx next dev --webpack -p 3002
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  // Generate unique build ID to bust cache
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Exclude large GeoJSON files from serverless function bundles
  // These files are served as static assets from /public, not needed in API routes
  outputFileTracingExcludes: {
    '*': [
      './public/geojson/**',
    ],
  },
  // Exclude 1.3GB of static GeoJSON from Turbopack/webpack watching in dev
  // These files are served as-is from /public and rarely change
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/public/geojson/**',
        ],
      };
    }
    return config;
  },
  transpilePackages: ['recharts'],
  turbopack: {},
  // Custom response headers
  async headers() {
    return [
      {
        // Allow iframe embedding for /embed/* routes
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;