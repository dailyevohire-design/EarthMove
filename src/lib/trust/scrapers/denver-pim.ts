import type { ScraperEvidence } from './types';
import {
  type PermitRecord,
  normalizePermits,
  computeSignals,
  emitFindings,
  emitFetchErrorFinding,
} from './permit-normalize';

const SOURCE_KEY = 'denver_pim';
const JURISDICTION = 'denver';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROWS = 200;

/**
 * Denver exposes Residential + Commercial Construction Permits as separate
 * ArcGIS FeatureServer layers with identical schemas. We aggregate across
 * both layers before computing signals so a contractor's full Denver history
 * is reflected in a single set of findings. Street Occupancy permits (right-
 * of-way work) are intentionally excluded — they're not building permits and
 * don't reflect contractor capability the same way.
 *
 * Both layers expose: CONTRACTOR_NAME, DATE_ISSUED (epoch ms), PERMIT_NUM,
 * CLASS, ADDRESS.
 */
const LAYERS: Array<{ name: string; url: string }> = [
  {
    name: 'residential',
    url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_DEV_RESIDENTIALCONSTPERMIT_P/FeatureServer/316',
  },
  {
    name: 'commercial',
    url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_DEV_COMMERCIALCONSTPERMIT_P/FeatureServer/317',
  },
];

export interface DenverPermitsInput {
  legalName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  asOf?: Date;
}

interface DenverFeature {
  attributes?: {
    CONTRACTOR_NAME?: string;
    DATE_ISSUED?: number; // epoch ms
    PERMIT_NUM?: string;
    CLASS?: string;
    ADDRESS?: string;
    [k: string]: unknown;
  };
}

function epochMsToISO(ms: number | undefined | null): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function adapt(f: DenverFeature): PermitRecord | null {
  const a = f.attributes ?? {};
  const issued = epochMsToISO(a.DATE_ISSUED);
  if (!issued) return null;
  if (!a.PERMIT_NUM) return null;
  return {
    permit_number: String(a.PERMIT_NUM),
    issued_date: issued,
    work_class: String(a.CLASS ?? ''),
    address: String(a.ADDRESS ?? ''),
    status: '',
    contractor_name: a.CONTRACTOR_NAME ? String(a.CONTRACTOR_NAME) : null,
  };
}

async function fetchLayer(args: {
  url: string;
  legalName: string;
  fetchFn: typeof fetch;
  signal: AbortSignal;
}): Promise<DenverFeature[]> {
  const escaped = args.legalName.replace(/'/g, "''");
  const where = `UPPER(CONTRACTOR_NAME) LIKE UPPER('%${escaped}%')`;
  const url = `${args.url}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=${MAX_ROWS}&f=json`;
  const resp = await args.fetchFn(url, { signal: args.signal });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const body = (await resp.json()) as { features?: DenverFeature[]; error?: { message?: string } };
  if (body.error) throw new Error(`ArcGIS error: ${body.error.message ?? 'unknown'}`);
  return body.features ?? [];
}

export async function scrapeDenverPermits(input: DenverPermitsInput): Promise<ScraperEvidence[]> {
  const fetchFn = input.fetchFn ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const asOf = input.asOf ?? new Date();
  const legalName = input.legalName.trim();

  if (!legalName) {
    return [emitFetchErrorFinding({
      source_key: SOURCE_KEY, jurisdiction: JURISDICTION, contractor_name: '',
      error: new Error('legalName required'),
    })];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const allRaw: DenverFeature[] = [];
  const skippedLayers: Array<{ layer: string; error: string }> = [];

  try {
    for (const layer of LAYERS) {
      try {
        const rows = await fetchLayer({
          url: layer.url, legalName, fetchFn, signal: controller.signal,
        });
        allRaw.push(...rows);
      } catch (err) {
        skippedLayers.push({
          layer: layer.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // If every layer failed, return a single unverified informational row.
  if (allRaw.length === 0 && skippedLayers.length === LAYERS.length) {
    return [emitFetchErrorFinding({
      source_key: SOURCE_KEY, jurisdiction: JURISDICTION, contractor_name: legalName,
      error: new Error(`all layers failed: ${skippedLayers.map((s) => `${s.layer}=${s.error}`).join('; ')}`),
    })];
  }

  const permits = normalizePermits(allRaw, adapt);
  const findings = emitFindings(permits, computeSignals(permits, asOf), {
    source_key: SOURCE_KEY,
    jurisdiction: JURISDICTION,
    contractor_name: legalName,
    asOf,
  });

  // If some layers were skipped, annotate the informational row's extracted_facts.
  if (skippedLayers.length > 0 && findings.length > 0) {
    const info = findings[0];
    info.extracted_facts = {
      ...info.extracted_facts,
      skipped_layers: skippedLayers,
    };
  }

  return findings;
}
