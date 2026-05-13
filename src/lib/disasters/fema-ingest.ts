/**
 * FEMA Disaster Declarations -> disaster_windows.
 * https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries
 * Free public API, no auth, hourly polling.
 * Captures the post-disaster federal recovery window (the 30-90 day
 * storm-chaser period) that NWS active-alerts misses.
 */

export const FEMA_DISASTERS_URL =
  'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';

export const LAUNCH_MARKET_STATES = new Set<string>([
  'CO', 'TX', 'OR', 'AZ', 'NV', 'GA', 'FL', 'NC',
]);

export type FemaDisaster = {
  disasterNumber: number;
  state: string;
  declarationType: string;
  declarationDate: string;
  incidentType: string;
  declarationTitle: string;
  incidentBeginDate: string;
  incidentEndDate: string | null;
  designatedArea: string;
};

export type FemaResponse = {
  DisasterDeclarationsSummaries: FemaDisaster[];
};

export function mapIncidentType(incident: string): string | null {
  const s = (incident || '').toLowerCase();
  if (/hurricane/.test(s)) return 'hurricane';
  if (/tropical (storm|depression)/.test(s)) return 'tropical_storm';
  if (/tornado/.test(s)) return 'tornado';
  if (/(wildfire|^fire$|fire complex)/.test(s)) return 'wildfire';
  if (/flood/.test(s)) return 'flood';
  if (/severe storm/.test(s)) return 'severe_storm';
  if (/(winter|snow|ice)/.test(s)) return 'winter_storm';
  if (/earthquake/.test(s)) return 'earthquake';
  if (/tsunami/.test(s)) return 'tsunami';
  if (/volcan/.test(s)) return 'volcanic_activity';
  return null;
}

export function mapDeclarationSeverity(
  declarationType: string
): 'minor' | 'moderate' | 'severe' | 'extreme' {
  if (declarationType === 'DR') return 'severe';
  if (declarationType === 'EM') return 'moderate';
  if (declarationType === 'FM') return 'moderate';
  return 'minor';
}

export type IngestSupabaseClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type IngestSummary = {
  fetched_total: number;
  filtered_by_event_type: number;
  filtered_by_market: number;
  upserted: number;
  errors: { id: string; message: string }[];
};

export type IngestOptions = {
  fetchImpl?: typeof fetch;
  url?: string;
  daysBack?: number;
};

export async function ingestFemaDisasters(
  supabase: IngestSupabaseClient,
  options: IngestOptions = {}
): Promise<IngestSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const daysBack = options.daysBack ?? 90;
  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000)
    .toISOString()
    .substring(0, 10);

  const params = new URLSearchParams({
    '$filter': "declarationDate ge '" + cutoff + "'",
    '$top': '1000',
    '$orderby': 'declarationDate desc',
  });
  const url = options.url ?? FEMA_DISASTERS_URL + '?' + params.toString();

  const summary: IngestSummary = {
    fetched_total: 0,
    filtered_by_event_type: 0,
    filtered_by_market: 0,
    upserted: 0,
    errors: [],
  };

  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('FEMA API ' + response.status + ': ' + body.slice(0, 200));
  }

  const data = (await response.json()) as FemaResponse;
  const declarations = data.DisasterDeclarationsSummaries ?? [];
  summary.fetched_total = declarations.length;

  // Dedup by (disasterNumber, state) — FEMA returns one row per designated county
  const grouped = new Map<string, FemaDisaster>();
  for (const d of declarations) {
    const key = d.disasterNumber + '_' + d.state;
    if (!grouped.has(key)) grouped.set(key, d);
  }

  for (const d of grouped.values()) {
    const eventType = mapIncidentType(d.incidentType);
    if (!eventType) { summary.filtered_by_event_type++; continue; }
    if (!LAUNCH_MARKET_STATES.has(d.state)) { summary.filtered_by_market++; continue; }

    const externalId = 'fema:' + d.disasterNumber + ':' + d.state;
    const declaredAt = d.declarationDate;
    const effectiveFrom = d.incidentBeginDate || d.declarationDate;
    const effectiveUntil = d.incidentEndDate
      ? new Date(new Date(d.incidentEndDate).getTime() + 90 * 24 * 3600 * 1000).toISOString()
      : new Date(new Date(effectiveFrom).getTime() + 120 * 24 * 3600 * 1000).toISOString();

    try {
      const { error } = await supabase.rpc('upsert_disaster_window', {
        p_source: 'fema',
        p_source_external_id: externalId,
        p_event_type: eventType,
        p_event_name: d.declarationTitle,
        p_severity: mapDeclarationSeverity(d.declarationType),
        p_affected_state_codes: [d.state],
        p_affected_county_fips: null,
        p_affected_zip_codes: null,
        p_declared_at: declaredAt,
        p_effective_from: effectiveFrom,
        p_effective_until: effectiveUntil,
        p_metadata: {
          fema_disaster_number: d.disasterNumber,
          fema_declaration_type: d.declarationType,
          fema_incident_type: d.incidentType,
          fema_designated_area: d.designatedArea,
        },
        p_raw_source: d as unknown as Record<string, unknown>,
      });
      if (error) {
        const msg = typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
        summary.errors.push({ id: externalId, message: msg });
      } else {
        summary.upserted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push({ id: externalId, message: msg });
    }
  }

  return summary;
}
