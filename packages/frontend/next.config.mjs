import { withSentryConfig } from '@sentry/nextjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// De-scored market pages: generated monthly by scripts/generate-descored-redirects.ts.
// Seed is [] so this is a no-op until the first generation run.
const descoredRedirects = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./lib/data/descored-redirects.json', import.meta.url)),
    'utf8',
  ),
);

/** @type {import('next').NextConfig} */
// Build cache buster: 2026-02-10-001

// Absolute path to the bounded in-memory cache handler (see cache-handler.cjs).
const cacheHandlerPath = fileURLToPath(
  new URL('./cache-handler.cjs', import.meta.url),
);

// In development, allow fetch to the local backend (port 3001).
// In production the backend is on *.railway.app which is already listed.
const devConnectSrc = process.env.NODE_ENV === 'development'
  ? ' http://localhost:3001'
  : '';

const nextConfig = {
  // Dist-dir resolution — keeps `next build` from clobbering a running dev server.
  //   1. explicit NEXT_DIST_DIR wins (parallel instances: NEXT_DIST_DIR=.next-test npx next dev -p 3002)
  //   2. `next dev` (NODE_ENV=development) -> `.next-dev`, isolated from any build
  //   3. `next build` / `next start` (NODE_ENV=production) -> `.next` (what Dockerfile.frontend ships)
  // So a default `npm run build` writes `.next` while dev lives in `.next-dev` and survives,
  // no matter who runs the build. Dev wipe + gitignore + tsconfig follow this dir; see scripts/dev-start.sh.
  distDir:
    process.env.NEXT_DIST_DIR ||
    (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  output: 'standalone',
  poweredByHeader: false,
  // Bounded in-memory server cache (ISR, route handlers, optimized images) in
  // production. Replaces Next's default disk cache, whose unbounded files
  // crashed the Railway container on the ephemeral-storage file-count limit
  // (see cache-handler.cjs). cacheMaxMemorySize:0 disables the default in-memory
  // layer so our handler is the sole cache. Left off in dev so HMR is untouched.
  ...(process.env.NODE_ENV === 'production'
    ? { cacheHandler: cacheHandlerPath, cacheMaxMemorySize: 0 }
    : {}),
  // Stable build ID (git commit) so restarts/instances agree on cache keys and
  // asset URLs; falls back to a timestamp if the commit isn't exposed at build.
  generateBuildId: async () => {
    return (
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.GIT_HASH ||
      `build-${Date.now()}`
    );
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
  // The methodology page reads this .md at request time via fs.readFileSync.
  // Dynamic reads aren't auto-traced into the standalone build, so include it
  // explicitly or the page 500s in production (H5).
  outputFileTracingIncludes: {
    '/scores/methodology': [
      './app/(app)/scores/methodology/validation-report.md',
    ],
    // The /api/agent-markdown route reads blog .mdx + the methodology .md at
    // request time; trace them into its standalone bundle or it 500s in prod.
    '/api/agent-markdown': [
      './content/blog/**',
      './app/(app)/scores/methodology/validation-report.md',
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
      // ── Railway deploy alias → www canonical (H3) ────────────────
      // propertyiq.up.railway.app serves byte-identical copies of every page.
      // Config-level (not just middleware) so it also catches .xml/.txt, which
      // the middleware matcher skips. Exact host only — preview/staging deploys
      // on other *.up.railway.app subdomains are intentionally left alone.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'propertyiq.up.railway.app' }],
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
      // ── Compare tool relocated: /compare/markets → /market/compare ──
      // The market-comparison tool moved under the authed /market section
      // (it's a gated app feature, not a public /compare SEO page).
      {
        source: '/compare/markets',
        destination: '/market/compare',
        permanent: true,
      },
      // ── De-scored market pages → ancestor geography ───────────────
      // Generated monthly by scripts/generate-descored-redirects.ts.
      // Seed is [] (no-op) until first generation run.
      ...descoredRedirects,
    ];
  },
  // Serve agent-discovery documents at their canonical well-known paths. Next's
  // App Router can't route dot-prefixed folders, so the real handlers live under
  // /api/agent-discovery/* and we rewrite the public paths to them.
  async rewrites() {
    return [
      {
        source: '/.well-known/mcp/server-card.json',
        destination: '/api/agent-discovery/server-card',
      },
      {
        source: '/.well-known/api-catalog',
        destination: '/api/agent-discovery/api-catalog',
      },
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/agent-discovery/oauth-protected-resource',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/agent-discovery/oauth-authorization-server',
      },
      {
        source: '/.well-known/agent-skills/index.json',
        destination: '/api/agent-discovery/agent-skills-index',
      },
      {
        source: '/.well-known/agent-skills/:name/SKILL.md',
        destination: '/api/agent-discovery/agent-skill/:name',
      },
      // Short-path aliases for agent-skills. The canonical location is under
      // /.well-known/, but the shorter /agent-skills/* path is commonly probed
      // and 404s otherwise. Next's rewrites don't chain, so these target the
      // same handlers as the /.well-known/agent-skills/* rewrites above rather
      // than rewriting to the /.well-known/ path (which the App Router can't
      // serve — it can't route dot-prefixed folders).
      {
        source: '/agent-skills/index.json',
        destination: '/api/agent-discovery/agent-skills-index',
      },
      {
        source: '/agent-skills/:name/SKILL.md',
        destination: '/api/agent-discovery/agent-skill/:name',
      },
      {
        source: '/.well-known/agent-card.json',
        destination: '/api/agent-discovery/a2a-agent-card',
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
          { key: 'Link', value: '</.well-known/api-catalog>; rel="api-catalog", </docs/mcp>; rel="service-doc"' },
          { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://*.google-analytics.com; media-src 'self' blob: https://*.supabase.co; connect-src 'self'${devConnectSrc} https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.railway.app https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.google.com https://stats.g.doubleclick.net https://*.doubleclick.net https://*.ingest.sentry.io; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';` },
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