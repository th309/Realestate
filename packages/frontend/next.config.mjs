import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
// Build cache buster: 2026-02-10-001

// In development, allow fetch to the local backend (port 3001).
// In production the backend is on *.railway.app which is already listed.
const devConnectSrc = process.env.NODE_ENV === 'development'
  ? ' http://localhost:3001'
  : '';

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
  // 301 redirects for old URLs that Google may have indexed.
  // Fixes "Not found (404)" errors in Google Search Console.
  async redirects() {
    return [
      // ── Non-www → www canonical redirect ─────────────────────────
      // The middleware handles this for most routes, but its matcher
      // explicitly excludes .xml and .txt extensions for performance,
      // so robots.txt and sitemap.xml bypass it. This config-level
      // redirect catches all paths on the non-www domain, including
      // those file extensions.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'propertyiq.app' }],
        destination: 'https://www.propertyiq.app/:path*',
        permanent: true,
      },
      // ── Blog: duplicate slugs (SEO cannibalization fix) ──────────
      {
        source: '/blog/huntsville-alabama-real-estate-market-2026',
        destination: '/blog/huntsville-al-real-estate-market-2026',
        permanent: true,
      },
      {
        source: '/blog/knoxville-real-estate-market-2026',
        destination: '/blog/knoxville-tn-real-estate-market-2026',
        permanent: true,
      },
      {
        source: '/blog/omaha-real-estate-market-2026',
        destination: '/blog/omaha-ne-real-estate-market-2026',
        permanent: true,
      },
      {
        source: '/blog/richmond-virginia-real-estate-market-2026',
        destination: '/blog/richmond-va-real-estate-market-2026',
        permanent: true,
      },
      {
        source: '/blog/spokane-real-estate-market-2026',
        destination: '/blog/spokane-wa-real-estate-market-2026',
        permanent: true,
      },
      // ── Auth: legacy /auth/login pattern ─────────────────────────
      // Old links pointed to /auth/login; canonical route is /auth/sign-in.
      {
        source: '/auth/login',
        destination: '/auth/sign-in',
        permanent: true,
      },
      {
        source: '/login',
        destination: '/auth/sign-in',
        permanent: true,
      },
      {
        source: '/signup',
        destination: '/auth/sign-up',
        permanent: true,
      },
      {
        source: '/auth/signup',
        destination: '/auth/sign-up',
        permanent: true,
      },
      // ── Methodology: top-level /methodology → /scores/methodology
      {
        source: '/methodology',
        destination: '/scores/methodology',
        permanent: true,
      },
    ];
  },
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
          { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://*.google-analytics.com; media-src 'self' blob: https://*.supabase.co; connect-src 'self'${devConnectSrc} https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.railway.app https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.google.com https://*.ingest.sentry.io; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';` },
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

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set in CI or locally for source map uploads).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in CI to avoid leaking them locally.
  silent: true,
  disableServerWebpackPlugin: !process.env.CI,
  disableClientWebpackPlugin: !process.env.CI,

  // Tree-shake Sentry debug logging out of production bundles.
  hideSourceMaps: true,
  widenClientFileUpload: true,
});