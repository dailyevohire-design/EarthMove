import { createHash } from 'node:crypto';
import { fetchCobaltSosDetails, CobaltApiError } from '@/lib/trust/sources/cobalt';
import type { ScraperEvidence } from './types';

interface CobaltInput {
  legalName: string;
  stateCode: string;
}

const SOURCE_KEY = 'cobalt_intelligence';
const COST_CENTS = 150;

function statusToFinding(rawStatus: string): {
  finding_type: ScraperEvidence['finding_type'];
  active: boolean | null;
} {
  const s = rawStatus.toLowerCase();
  if (/dissol|forfeit|inactive|cancel|delinquent|revoked|terminated/.test(s)) {
    return { finding_type: 'business_inactive', active: false };
  }
  if (/active|good\s*standing|current/.test(s)) {
    return { finding_type: 'business_active', active: true };
  }
  return { finding_type: 'open_web_verified', active: null };
}

export async function scrapeCobaltIntelligence(input: CobaltInput): Promise<ScraperEvidence> {
  const start = Date.now();
  const query_sent = `cobalt:${input.stateCode}:${input.legalName}`;

  try {
    const result = await fetchCobaltSosDetails(input.legalName, input.stateCode);
    const canonical = result.canonical;
    const raw = result.raw;
    const rawText = JSON.stringify(raw);

    const hasMatch = Boolean(canonical.entityName || canonical.sosId || canonical.status);
    if (!hasMatch) {
      return {
        source_key: SOURCE_KEY,
        finding_type: 'business_not_found',
        confidence: 'verified_structured',
        finding_summary: `Cobalt SOS ${input.stateCode}: no match for "${input.legalName}"`,
        extracted_facts: { input_name: input.legalName, state: input.stateCode },
        query_sent,
        response_sha256: createHash('sha256').update(rawText).digest('hex'),
        response_snippet: rawText.slice(0, 500),
        duration_ms: Date.now() - start,
        cost_cents: COST_CENTS,
      };
    }

    const rawStatus = canonical.status ?? '';
    const { finding_type } = statusToFinding(rawStatus);
    const entityName = canonical.entityName ?? input.legalName;

    return {
      source_key: SOURCE_KEY,
      finding_type,
      confidence: 'verified_structured',
      finding_summary: `Cobalt SOS ${input.stateCode}: "${entityName}" status=${rawStatus || 'unknown'}${canonical.formationDate ? `, formed ${canonical.formationDate}` : ''}`,
      extracted_facts: {
        entity_name: entityName,
        state: input.stateCode,
        status: rawStatus || null,
        sos_id: canonical.sosId ?? null,
        filing_number: canonical.filingNumber ?? null,
        entity_type: canonical.entityType ?? null,
        formation_date: canonical.formationDate ?? null,
        dissolved_date: canonical.dissolvedDate ?? null,
        registered_agent: canonical.registeredAgent ?? null,
        principals: canonical.principals ?? null,
        principal_address: canonical.principalAddress ?? null,
      },
      query_sent,
      response_sha256: createHash('sha256').update(rawText).digest('hex'),
      response_snippet: rawText.slice(0, 500),
      duration_ms: Date.now() - start,
      cost_cents: COST_CENTS,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof CobaltApiError ? err.status : null;
    return {
      source_key: SOURCE_KEY,
      finding_type: 'source_error',
      confidence: 'low_inference',
      finding_summary: `Cobalt scrape failed${status ? ` (HTTP ${status})` : ''}: ${message}`,
      extracted_facts: { error: message, http_status: status },
      query_sent,
      response_sha256: null,
      response_snippet: null,
      duration_ms: Date.now() - start,
      cost_cents: 0,
    };
  }
}
