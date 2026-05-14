// src/lib/trust/sources/cobalt.ts
//
// Cobalt Intelligence SOS API client.
// Universal SOS source — registered as source_key='cobalt_intelligence' (mig 249).
// Demotes per-state SOS scrapers (co_sos_biz, tx_sos_biz, etc.) to fallback role.
// Paid: ~$1.50/call. Cache 30-90d per blueprint Section 10. Rate limit 10/min (registry).
//
// API:    GET https://apigateway.cobaltintelligence.com/v1/search?searchQuery=...&state=...
// Auth:   x-api-key header (env COBALT_API_KEY)
// State:  full name ("Georgia") — client auto-expands 2-letter codes.

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

const COBALT_API_BASE = 'https://apigateway.cobaltintelligence.com/v1/search';

export interface CobaltPrincipal {
  name?: string;
  title?: string;
  address?: string;
}

export interface CobaltCanonical {
  title?: string;
  entityName?: string;
  sosId?: string;
  filingNumber?: string;
  entityType?: string;
  status?: string;
  filingDate?: string;
  formationDate?: string;
  dissolvedDate?: string;
  jurisdictionOfFormation?: string;
  agentName?: string;
  agentAddress?: string;
  registeredAgent?: { name?: string; address?: string };
  principals?: CobaltPrincipal[];
  principalAddress?: string;
  mailingAddress?: string;
  screenshotUrl?: string;
  source?: string;
}

export interface CobaltSearchResult {
  /** Best-effort typed extraction of canonical SOS fields. */
  canonical: CobaltCanonical;
  /** Full unmodified API response — persist to trust_evidence.raw_payload. */
  raw: Record<string, unknown>;
  /** HTTP metadata for evidence lineage. */
  http: {
    status: number;
    requestedAt: string;
    durationMs: number;
    url: string;
  };
}

export class CobaltApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'CobaltApiError';
  }
}

function resolveStateName(state: string): string {
  const trimmed = state.trim();
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    const full = STATE_NAMES[upper];
    if (!full) throw new Error(`Unknown US state code: ${upper}`);
    return full;
  }
  return trimmed;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getPrincipals(
  obj: Record<string, unknown>,
  key: string,
): CobaltPrincipal[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  const out: CobaltPrincipal[] = [];
  for (const item of v) {
    if (item && typeof item === 'object') {
      const i = item as Record<string, unknown>;
      out.push({
        name: getString(i, 'name'),
        title: getString(i, 'title'),
        address: getString(i, 'address'),
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

function getAgent(
  obj: Record<string, unknown>,
  key: string,
): { name?: string; address?: string } | undefined {
  const v = obj[key];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const i = v as Record<string, unknown>;
  const name = getString(i, 'name');
  const address = getString(i, 'address');
  return name || address ? { name, address } : undefined;
}

function extractCanonical(raw: Record<string, unknown>): CobaltCanonical {
  return {
    title: getString(raw, 'title'),
    entityName: getString(raw, 'entityName') ?? getString(raw, 'name'),
    sosId: getString(raw, 'sosId') ?? getString(raw, 'entityId'),
    filingNumber: getString(raw, 'filingNumber'),
    entityType: getString(raw, 'entityType') ?? getString(raw, 'type'),
    status: getString(raw, 'status'),
    filingDate: getString(raw, 'filingDate'),
    formationDate:
      getString(raw, 'formationDate') ?? getString(raw, 'incorporationDate'),
    dissolvedDate: getString(raw, 'dissolvedDate'),
    jurisdictionOfFormation:
      getString(raw, 'jurisdictionOfFormation') ?? getString(raw, 'state'),
    agentName: getString(raw, 'agentName'),
    agentAddress: getString(raw, 'agentAddress'),
    registeredAgent: getAgent(raw, 'registeredAgent') ?? getAgent(raw, 'agent'),
    principals: getPrincipals(raw, 'principals') ?? getPrincipals(raw, 'officers'),
    principalAddress: getString(raw, 'principalAddress'),
    mailingAddress: getString(raw, 'mailingAddress'),
    screenshotUrl: getString(raw, 'screenshotUrl') ?? getString(raw, 'screenshot'),
    source: getString(raw, 'source'),
  };
}

function normalizeShape(parsed: unknown): Record<string, unknown> {
  if (Array.isArray(parsed)) {
    return (parsed[0] ?? {}) as Record<string, unknown>;
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
      return obj.result as Record<string, unknown>;
    }
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as Record<string, unknown>;
    }
    return obj;
  }
  return {};
}

/**
 * Fetch business entity details from Cobalt Intelligence SOS API.
 *
 * @throws CobaltApiError on non-2xx response
 * @throws Error on missing key, unknown state, abort, or non-JSON body
 */
export async function fetchCobaltSosDetails(
  businessName: string,
  state: string,
  opts: {
    apiKey?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<CobaltSearchResult> {
  const apiKey = opts.apiKey ?? process.env.COBALT_API_KEY;
  if (!apiKey) {
    throw new Error('COBALT_API_KEY not set (check .env.local or Vercel env)');
  }
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const stateName = resolveStateName(state);
  const url = `${COBALT_API_BASE}?searchQuery=${encodeURIComponent(businessName)}&state=${encodeURIComponent(stateName)}`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const requestedAt = new Date().toISOString();

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const bodyText = await res.text();

    if (!res.ok) {
      throw new CobaltApiError(
        `Cobalt API ${res.status} for "${businessName}" / ${stateName}`,
        res.status,
        bodyText.slice(0, 1000),
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      throw new CobaltApiError(
        `Cobalt returned non-JSON for "${businessName}" / ${stateName}`,
        res.status,
        bodyText.slice(0, 1000),
      );
    }

    const raw = normalizeShape(parsed);
    const canonical = extractCanonical(raw);

    return {
      canonical,
      raw,
      http: {
        status: res.status,
        requestedAt,
        durationMs: Date.now() - startedAt,
        url,
      },
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
