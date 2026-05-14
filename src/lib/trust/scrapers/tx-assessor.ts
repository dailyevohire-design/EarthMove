/**
 * Texas County Assessor scraper — DFW (DCAD + TAD) for v1.
 *
 * Strategy: ArcGIS Feature Service first (no captcha possible on public GIS
 * services), HTML fallback only if ArcGIS unreachable. Houston (HCAD), Austin
 * (TCAD), San Antonio (BCAD) follow same shape in subsequent commits.
 *
 * KNOWN STATE (2026-05-14 recon):
 *   - DCAD `gis.dallascad.org/arcgis/rest/services` → HTTP 404 (no public GIS)
 *   - TAD `gis.tad.org/arcgis/rest/services` → HTTP 404 (no public GIS)
 *   - DCAD owner search at dallascad.org/SearchOwner.aspx IS available (ASP.NET
 *     WebForms with VIEWSTATE, no captcha). Not yet implemented here.
 *   - TAD search at tad.org/search-results has reCaptcha v3 (blocked).
 *
 * This v1 scaffolds the ArcGIS-first path. On full attempt failure it returns
 * source_error with the `attempts` array — that array IS the diagnostic for
 * the next iteration. v2 will swap ArcGIS for DCAD WebForms POST + replace
 * TAD with a captcha-free alternative.
 *
 * Coverage: Property ownership and parcel data. Used by trust pipeline to
 * verify counterparty identity for delivery addresses (closes the fake-check
 * scam vector — see EARTHMOVE_TX_ASSESSOR rationale).
 *
 * Returns single ScraperEvidence:
 *   business_active          - owner name match found (entity-form owner)
 *   address_commercial       - owner name match (individual or other)
 *   business_not_found       - no parcel records under that name
 *   source_error             - all endpoint strategies failed (captures responses)
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperRateLimitError,
  ScraperTimeoutError,
} from './types';
import { normalizeForExternalQuery } from './_helpers/normalize-for-query';

const SOURCE_KEY = 'tx_assessor';
const TIMEOUT_MS = 12_000;
const COST_CENTS = 0;
const USER_AGENT = 'Earth Pro Connect LLC trust@earthmove.io';

interface CadConfig {
  district: string;
  county: string;
  arcgis_candidates: string[];
  owner_field_candidates: string[];
}

const CADS: CadConfig[] = [
  {
    district: 'DCAD',
    county: 'Dallas',
    arcgis_candidates: [
      'https://gis.dallascad.org/arcgis/rest/services/Public/MapServer/0',
      'https://gis.dallascad.org/arcgis/rest/services/Parcels/MapServer/0',
      'https://gis.dallascad.org/server/rest/services/Public/MapServer/0',
    ],
    owner_field_candidates: ['OWNER_NAME', 'OWNER1', 'OWNER', 'OwnerName'],
  },
  {
    district: 'TAD',
    county: 'Tarrant',
    arcgis_candidates: [
      'https://gis.tad.org/arcgis/rest/services/Parcels/MapServer/0',
      'https://gis.tad.org/arcgis/rest/services/Public/MapServer/0',
      'https://services.arcgis.com/tad/arcgis/rest/services/Parcels/FeatureServer/0',
    ],
    owner_field_candidates: ['Owner_Name', 'OWNER_NAME', 'OWNER1', 'OwnerName'],
  },
];

export interface ScrapeTxAssessorInput {
  query_name: string;
  jurisdiction: string;
  city?: string | null;
  contractor_id?: string;
  job_id?: string;
}

interface ArcGisQueryResult {
  features?: Array<{ attributes?: Record<string, unknown> }>;
  error?: { code?: number; message?: string; details?: string[] };
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeTxAssessor(
  input: ScrapeTxAssessorInput,
): Promise<ScraperEvidence> {
  const normalized = normalizeForExternalQuery(input.query_name).replace(/'/g, "''");
  const city = (input.city ?? '').toLowerCase();

  const orderedCads = [...CADS].sort((a) =>
    city.includes(a.county.toLowerCase()) ? -1 : 1,
  );

  const attempts: Array<{
    district: string;
    url: string;
    status: number | string;
    note: string;
  }> = [];

  const overallStart = Date.now();

  for (const cad of orderedCads) {
    for (const baseUrl of cad.arcgis_candidates) {
      for (const ownerField of cad.owner_field_candidates) {
        const queryUrl = `${baseUrl}/query?where=${encodeURIComponent(
          `UPPER(${ownerField}) LIKE UPPER('%${normalized}%')`,
        )}&outFields=*&returnGeometry=false&f=json&resultRecordCount=10`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const start = Date.now();

        let response: Response;
        try {
          response = await fetch(queryUrl, {
            method: 'GET',
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: controller.signal,
            redirect: 'follow',
          });
        } catch (err: any) {
          clearTimeout(timeoutId);
          attempts.push({
            district: cad.district,
            url: baseUrl,
            status: 'network',
            note: `${ownerField}: ${err?.message ?? err}`,
          });
          if (err?.name === 'AbortError') {
            throw new ScraperTimeoutError(
              `tx_assessor: ${cad.district} ${baseUrl} timed out after ${TIMEOUT_MS}ms`,
              SOURCE_KEY,
            );
          }
          continue;
        }
        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new ScraperRateLimitError(
            `${cad.district} rate limited`,
            SOURCE_KEY,
            60,
          );
        }

        if (!response.ok) {
          attempts.push({
            district: cad.district,
            url: baseUrl,
            status: response.status,
            note: `${ownerField}: HTTP ${response.status}`,
          });
          continue;
        }

        const rawText = await response.text();
        let data: ArcGisQueryResult;
        try {
          data = JSON.parse(rawText) as ArcGisQueryResult;
        } catch {
          attempts.push({
            district: cad.district,
            url: baseUrl,
            status: response.status,
            note: `${ownerField}: non-JSON response`,
          });
          continue;
        }

        if (data.error) {
          attempts.push({
            district: cad.district,
            url: baseUrl,
            status: data.error.code ?? response.status,
            note: `${ownerField}: ${data.error.message}`,
          });
          continue;
        }

        const features = data.features ?? [];
        const querySent = `GET ${queryUrl}`;
        const duration_ms = Date.now() - start;
        const response_sha256 = sha256Hex(rawText);
        const response_snippet = rawText.slice(0, 1500);

        if (features.length === 0) {
          return {
            source_key: SOURCE_KEY,
            finding_type: 'business_not_found',
            confidence: 'verified_structured',
            finding_summary: `${cad.district}: no parcels found under "${input.query_name}" (${cad.county} County)`,
            extracted_facts: {
              query_name: input.query_name,
              district: cad.district,
              county: cad.county,
              jurisdiction: 'TX',
              owner_field_used: ownerField,
              match_count: 0,
            },
            query_sent: querySent,
            response_sha256,
            response_snippet,
            duration_ms,
            cost_cents: COST_CENTS,
          };
        }

        const topRaw = features[0]?.attributes ?? {};
        const topOwner = String(topRaw[ownerField] ?? '');
        const isEntity = /\b(LLC|INC|CORP|LTD|LP|HOLDINGS|TRUST|CO\b|COMPANY)\b/i.test(
          topOwner,
        );

        const findingType: 'business_active' | 'address_reuse' = isEntity
          ? 'business_active'
          : 'address_reuse';

        return {
          source_key: SOURCE_KEY,
          finding_type: findingType,
          confidence: 'verified_structured',
          finding_summary: `${cad.district}: ${features.length} parcel${features.length === 1 ? '' : 's'} owned by "${topOwner}" (${cad.county} County)`,
          extracted_facts: {
            query_name: input.query_name,
            district: cad.district,
            county: cad.county,
            jurisdiction: 'TX',
            owner_field_used: ownerField,
            match_count: features.length,
            top_owner: topOwner,
            top_record: topRaw,
            sample_records: features.slice(0, 3).map((f) => f?.attributes ?? {}),
          },
          query_sent: querySent,
          response_sha256,
          response_snippet,
          duration_ms,
          cost_cents: COST_CENTS,
        };
      }
    }
  }

  const duration_ms = Date.now() - overallStart;
  const attemptsSnippet = JSON.stringify(attempts).slice(0, 1500);

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    confidence: 'low_inference',
    finding_summary: `tx_assessor: all ${attempts.length} endpoint attempts failed (DCAD + TAD ArcGIS unreachable or schema unknown). See extracted_facts.attempts for diagnostic.`,
    extracted_facts: {
      query_name: input.query_name,
      city: input.city ?? null,
      attempts,
      attempt_count: attempts.length,
    },
    query_sent: `multi-endpoint probe :: ${attempts.length} attempts`,
    response_sha256: null,
    response_snippet: attemptsSnippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}
