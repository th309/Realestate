/** @type {import('next').NextConfig} */
// Build cache buster: 2026-02-10-001
const nextConfig = {
  // Allow parallel dev instances (e.g., beta testing on port 3002)
  // Usage: NEXT_DIST_DIR=.next-test npx next dev --webpack -p 3002
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  poweredByHeader: false,
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
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://*.google-analytics.com; connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.railway.app https://*.supabase.co https://*.google-analytics.com https://www.googletagmanager.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" },
        ],
      },
      {
        // Override for embed routes — allow iframes
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ];
  },
};

export default nextConfig;