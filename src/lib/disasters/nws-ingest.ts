/**
 * NWS Active Alerts -> disaster_windows ingestion.
 *
 * Pure functions, no Inngest dependency. Callable from cron, scripts, or
 * tests. Designed for the upsert_disaster_window() RPC shipped in mig 248.
 *
 * Reference: https://www.weather.gov/documentation/services-web-api
 * Required headers: User-Agent with contact info. No auth, no API key.
 */

export const NWS_ACTIVE_ALERTS_URL = 'https://api.weather.gov/alerts/active';
export const NWS_USER_AGENT =
  'Groundcheck/1.0 (earthmove.io disaster ingest; ops@earthmove.io)';

// Launch markets. Expand as we expand markets.
export const LAUNCH_MARKET_STATES = new Set<string>([
  'CO', 'TX', 'OR', 'AZ', 'NV', 'GA', 'FL', 'NC',
]);

export type NwsSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

export type NwsAlertProperties = {
  id: string;
  event: string;
  headline?: string | null;
  description?: string | null;
  severity: NwsSeverity;
  urgency?: string | null;
  certainty?: string | null;
  sent: string;
  effective: string;
  expires: string;
  areaDesc?: string | null;
  geocode?: { SAME?: string[]; UGC?: string[] };
  senderName?: string | null;
};

export type NwsAlertFeature = {
  id: string;
  properties: NwsAlertProperties;
};

export type NwsAlertsResponse = {
  type: 'FeatureCollection';
  features: NwsAlertFeature[];
};

/** Map NWS event names to disaster_windows.event_type enum. */
export function mapEventType(event: string): string | null {
  const s = (event || '').toLowerCase();
  if (/hurricane/.test(s)) return 'hurricane';
  if (/tropical (storm|depression)/.test(s)) return 'tropical_storm';
  if (/tornado/.test(s)) return 'tornado';
  if (/(red flag|fire weather|extreme fire)/.test(s)) return 'wildfire';
  if (/flood/.test(s)) return 'flood';
  if (/(severe thunderstorm|severe weather)/.test(s)) return 'severe_storm';
  if (/(winter storm|blizzard|ice storm|heavy snow)/.test(s)) return 'winter_storm';
  if (/earthquake/.test(s)) return 'earthquake';
  if (/tsunami/.test(s)) return 'tsunami';
  if (/volcan/.test(s)) return 'volcanic_activity';
  return null;
}

export function mapSeverity(
  s: NwsSeverity
): 'minor' | 'moderate' | 'severe' | 'extreme' {
  switch (s) {
    case 'Extreme': return 'extreme';
    case 'Severe': return 'severe';
    case 'Moderate': return 'moderate';
    case 'Minor': return 'minor';
    default: return 'minor';
  }
}

/**
 * Extract state codes from UGC zone codes. UGC format: "XXY###" where
 * XX = state, Y = type (Z=zone, C=county), ### = code.
 */
export function extractStateCodes(ugc: string[] | undefined): string[] {
  if (!ugc || !Array.isArray(ugc)) return [];
  const states = new Set<string>();
  for (const code of ugc) {
    if (typeof code === 'string' && code.length >= 2 && /^[A-Z]{2}/.test(code)) {
      states.add(code.substring(0, 2));
    }
  }
  return Array.from(states);
}

// Minimal supabase shape we depend on (lets the smoke test stub).
// PromiseLike (not Promise) so it accepts supabase-js's chainable
// PostgrestFilterBuilder (which is thenable).
export type IngestSupabaseClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type IngestSummary = {
  fetched_total: number;
  filtered_by_event_type: number;
  filtered_by_state: number;
  filtered_by_market: number;
  upserted: number;
  errors: { id: string; message: string }[];
};

export type IngestOptions = {
  fetchImpl?: typeof fetch;
  url?: string;
  userAgent?: string;
};

/**
 * Fetch NWS active alerts, filter to launch markets and supported event
 * types, call upsert_disaster_window() for each match.
 */
export async function ingestNwsActiveAlerts(
  supabase: IngestSupabaseClient,
  options: IngestOptions = {}
): Promise<IngestSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? NWS_ACTIVE_ALERTS_URL;
  const userAgent = options.userAgent ?? NWS_USER_AGENT;

  const summary: IngestSummary = {
    fetched_total: 0,
    filtered_by_event_type: 0,
    filtered_by_state: 0,
    filtered_by_market: 0,
    upserted: 0,
    errors: [],
  };

  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/geo+json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`NWS API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as NwsAlertsResponse;
  summary.fetched_total = data.features?.length ?? 0;

  for (const alert of data.features ?? []) {
    const p = alert.properties;

    const eventType = mapEventType(p.event);
    if (!eventType) { summary.filtered_by_event_type++; continue; }

    const stateCodes = extractStateCodes(p.geocode?.UGC);
    if (stateCodes.length === 0) { summary.filtered_by_state++; continue; }

    const launchStates = stateCodes.filter((s) => LAUNCH_MARKET_STATES.has(s));
    if (launchStates.length === 0) { summary.filtered_by_market++; continue; }

    try {
      const { error } = await supabase.rpc('upsert_disaster_window', {
        p_source: 'nws',
        p_source_external_id: p.id,
        p_event_type: eventType,
        p_event_name: p.headline ?? p.event,
        p_severity: mapSeverity(p.severity),
        p_affected_state_codes: launchStates,
        p_affected_county_fips: p.geocode?.SAME ?? null,
        p_affected_zip_codes: null,
        p_declared_at: p.sent,
        p_effective_from: p.effective,
        p_effective_until: p.expires,
        p_metadata: {
          nws_event: p.event,
          nws_severity: p.severity,
          nws_urgency: p.urgency,
          nws_certainty: p.certainty,
          nws_area_desc: p.areaDesc,
          nws_sender: p.senderName,
        },
        p_raw_source: alert,
      });

      if (error) {
        const msg = typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
        summary.errors.push({ id: p.id, message: msg });
      } else {
        summary.upserted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push({ id: p.id, message: msg });
    }
  }

  return summary;
}
