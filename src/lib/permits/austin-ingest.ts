/**
 * Austin Open Data Issued Construction Permits -> contractor_permits.
 *
 * Source: https://data.austintexas.gov/resource/3syk-w9eu.json
 * Socrata SODA API, no auth, JSON. Pagination via $limit + $offset.
 *
 * MVP: ingest without contractor_id resolution. All permits land with
 * contractor_id=NULL. A follow-up resolver matches contractor_company_name
 * -> contractors.id via pg_trgm similarity. The data is useful even
 * unresolved — it populates the PERMIT_PORTFOLIO_MISMATCH alert pipeline.
 */

export const AUSTIN_PERMITS_URL =
  'https://data.austintexas.gov/resource/3syk-w9eu.json';

export type AustinPermit = {
  permit_class?: string;
  permit_type_desc?: string;
  applied_date?: string;
  issued_date?: string;
  status_current?: string;
  status_date?: string;
  project_id?: string;
  original_address1?: string;
  original_city?: string;
  original_state?: string;
  original_zip?: string;
  contractor_company_name?: string;
  contractor_full_name?: string;
  work_class?: string;
  description?: string;
  total_valuation_remodel?: string;
  latitude?: string;
  longitude?: string;
};

export type IngestSupabaseClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type IngestSummary = {
  fetched_total: number;
  skipped_no_contractor: number;
  skipped_no_address: number;
  upserted: number;
  errors: { id: string; message: string }[];
};

export type IngestOptions = {
  fetchImpl?: typeof fetch;
  url?: string;
  daysBack?: number;
  limit?: number;
};

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function dateOrNull(s: string | undefined): string | null {
  if (!s) return null;
  return s.substring(0, 10);
}

export async function ingestAustinPermits(
  supabase: IngestSupabaseClient,
  options: IngestOptions = {}
): Promise<IngestSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const daysBack = options.daysBack ?? 90;
  const limit = options.limit ?? 1000;
  const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000)
    .toISOString()
    .substring(0, 10);

  const params = new URLSearchParams({
    '$where': "issued_date >= '" + cutoff + "' AND contractor_company_name IS NOT NULL",
    '$limit': String(limit),
    '$order': 'issued_date DESC',
  });
  const url = options.url ?? AUSTIN_PERMITS_URL + '?' + params.toString();

  const summary: IngestSummary = {
    fetched_total: 0,
    skipped_no_contractor: 0,
    skipped_no_address: 0,
    upserted: 0,
    errors: [],
  };

  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('Austin Open Data ' + response.status + ': ' + body.slice(0, 200));
  }

  const permits = (await response.json()) as AustinPermit[];
  summary.fetched_total = permits.length;

  for (const p of permits) {
    if (!p.contractor_company_name) { summary.skipped_no_contractor++; continue; }
    if (!p.original_address1) { summary.skipped_no_address++; continue; }

    const projectId = p.project_id || ((p.applied_date ?? 'na') + '_' + p.original_address1).replace(/\s+/g, '_');

    try {
      const { error } = await supabase.rpc('upsert_contractor_permit', {
        p_contractor_id: null,
        p_contractor_raw: p.contractor_company_name,
        p_source: 'austin_open_data',
        p_source_id: projectId,
        p_permit_type: p.permit_type_desc ?? p.permit_class ?? null,
        p_status: p.status_current ?? null,
        p_work_desc: p.description ?? p.work_class ?? null,
        p_address: p.original_address1,
        p_city: p.original_city ?? 'Austin',
        p_state: p.original_state ?? 'TX',
        p_zip: p.original_zip ?? null,
        p_county: null,
        p_lat: parseNum(p.latitude),
        p_lng: parseNum(p.longitude),
        p_issued: dateOrNull(p.issued_date),
        p_completed: dateOrNull(p.status_date),
        p_value: parseNum(p.total_valuation_remodel),
        p_raw: p as unknown as Record<string, unknown>,
      });
      if (error) {
        const msg = typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
        summary.errors.push({ id: projectId, message: msg });
      } else {
        summary.upserted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push({ id: projectId, message: msg });
    }
  }

  return summary;
}
