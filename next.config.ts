import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gaawvpzzmotimblyesfp.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    qualities: [75, 85],
    unoptimized: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'earthmove.io', 'www.earthmove.io'],
    },
  },
  // The trust PDF route reads brand PNGs and TTF fonts via
  // fs.readFileSync(path.join(process.cwd(), ...)). Next's tracer only
  // follows JS imports, so these binary assets don't make it into the
  // serverless bundle by default — surfaces as "React error #31" inside
  // @react-pdf/renderer when the buffers come back empty/missing.
  outputFileTracingIncludes: {
    '/api/trust/report/[reportId]/pdf': [
      './public/brand/groundcheck-wordmark.png',
      './public/brand/groundcheck-stamp.png',
      './src/lib/trust/pdf/fonts/**/*.ttf',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // NOTE: next.config headers() sets OUTGOING response headers, not incoming
          // request-header stripping. Next 16's framework-level fix + the route-handler
          // check in /api/trust are the real CVE-2025-29927 defenses. This entry
          // exists as an audit/defense-in-depth signal only.
          { key: 'x-middleware-subrequest', value: '' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
  // Legacy /learn slugs that have no canonical successor — redirect to the
  // hub at the edge (308 permanent). Successor-based slugs are handled by
  // permanentRedirect() in src/app/(marketplace)/learn/[slug]/page.tsx.
  // Keep the slug list here in sync with LEGACY_HUB_REDIRECTS in
  // src/lib/learn/articles.ts.
  async redirects() {
    return [
      { source: '/learn/spring-project-guide-2025', destination: '/learn', permanent: true },
    ]
  },
}

export default nextConfig
