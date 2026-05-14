// Cheap UA-based bot filter for telemetry endpoints. Goal isn't perfect detection —
// just keeps obvious crawlers out of live_sessions and entity_events.

const BOT_UA_RE = /bot|crawler|spider|crawling|headless|lighthouse|axios|curl|wget|python-requests|go-http-client|java\/|node-fetch|got\/|httpx|scrapy|phantom|slimerjs|googlebot|bingbot|yandex|baidu|duckduckbot|facebookexternalhit|whatsapp|telegram|preview|monitor|uptimerobot|pingdom|statuscake|newrelic|datadog/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true; // missing UA = suspicious
  if (ua.length < 12) return true; // too short = suspicious
  return BOT_UA_RE.test(ua);
}

export function detectDevice(ua: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function extractIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}

export function extractGeo(req: Request): { city: string | null; region: string | null; country: string | null } {
  // Vercel edge headers. URL-encoded; decode safely.
  const dec = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    city: dec(req.headers.get('x-vercel-ip-city')),
    region: dec(req.headers.get('x-vercel-ip-country-region')),
    country: dec(req.headers.get('x-vercel-ip-country')),
  };
}
