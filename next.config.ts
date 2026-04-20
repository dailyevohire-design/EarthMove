import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    unoptimized: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'earthmove.io', 'www.earthmove.io'],
    },
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
}

export default nextConfig
