/** @type {import('next').NextConfig} */
// Build cache buster: 2026-02-10-001
const nextConfig = {
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
  transpilePackages: ['recharts'],
};

export default nextConfig;