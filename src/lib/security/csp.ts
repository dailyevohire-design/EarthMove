export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.openfreemap.org https://*.basemaps.cartocdn.com https://images.unsplash.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.openfreemap.org https://*.basemaps.cartocdn.com https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://*.upstash.io https://api.stripe.com",
    "frame-src https://js.stripe.com https://challenges.cloudflare.com",
    "media-src 'self' https://*.supabase.co",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
  ].join('; ');
}

export const REPORTING_ENDPOINTS = `csp-endpoint="/api/security/csp-report"`;
export const REPORT_TO = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: '/api/security/csp-report' }],
});

export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()','autoplay=()','camera=()','display-capture=()','document-domain=()',
    'encrypted-media=()','fullscreen=(self)','geolocation=(self)','gyroscope=()','magnetometer=()',
    'microphone=()','midi=()','payment=(self)','picture-in-picture=()','publickey-credentials-get=(self)',
    'screen-wake-lock=(self)','sync-xhr=()','usb=()','web-share=(self)','xr-spatial-tracking=()',
  ].join(', '),
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Reporting-Endpoints': REPORTING_ENDPOINTS,
  'Report-To': REPORT_TO,
};
