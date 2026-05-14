/**
 * Texas Department of Insurance — Workers' Compensation Coverage Verification (v2)
 *
 * Source category: regulatory_insurance_wc
 * Data origin: Texas Open Data Portal (Socrata SODA on data.texas.gov)
 *
 * v1 hit dead host apps.tdi.state.tx.us (DNS-unreachable) and fell back to parsing
 * the TDI landing page, producing false insurance_no_record findings against all
 * queried employers. v2 replaces the data source entirely.
 *
 * Two-dataset architecture (both published by TDI/DWC, both on data.texas.gov):
 *   Subscriber c4xz-httr     -> insurance_active_wc | insurance_lapsed | insurance_carrier_name
 *   Non-subscriber azae-8krr -> insurance_no_record
 *
 * Confidence rationale: TDI is the regulator that maintains both lists. A row in
 * either dataset IS the truth about coverage status as of the publication snapshot.
 * Subscriber data refreshes quarterly, non-subscriber monthly per TDI publication
 * cadence (verified 2026-05-14).
 */

import { createHash } from 'node:crypto';
import { strictNameMatch } from '../lib/html-scraper-helpers';
import type { ScraperEvidence, ScraperResult, TrustFindingType, TrustConfidence } from '../types';

const SOURCE_KEY = 'tx_wc_verify';
const SUBSCRIBER_RESOURCE = 'c4xz-httr';
const NON_SUBSCRIBER_RESOURCE = 'azae-8krr';
const BASE = 'https://data.texas.gov/resource';
const FETCH_TIMEOUT_MS = 20_000;
const COST_CENTS = 0;

export interface ScrapeTxWcVerifyInput {
  legalName: string;
  stateCode?: string;
}

interface AttemptRecord {
  dataset: 'subscriber' | 'non_subscriber';
  url: string;
  status: number;
  row_count: number;
  error?: string;
}

interface SubscriberRow {
  insured_employer_name?: string;
  policy_effective_date?: string;
  policy_expiration_date?: string;
  cancellation_effective_date?: string;
  coverage_provider_name?: string;
  insured_employer_city?: string;
  insured_employer_state?: string;
  [k: string]: unknown;
}

type NonSubscriberRow = Record<string, unknown>;

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function escapeSoql(s: string): string {
  return s.toUpperCase().replace(/'/g, "''");
}

function buildSubscriberUrl(query: string): string {
  // Use a literal % in source — encodeURIComponent converts to %25, Socrata
  // decodes back to %, SQL LIKE sees the wildcard. The previous form with
  // literal %25 in source got double-encoded to %2525 → Socrata saw literal
  // "%25" character, not the wildcard, causing zero-match against real entities.
  const where = `upper(insured_employer_name) like '${escapeSoql(query)}%'`;
  return `${BASE}/${SUBSCRIBER_RESOURCE}.json?$where=${encodeURIComponent(where)}&$limit=50`;
}

function buildNonSubscriberUrl(query: string): string {
  // Real column name is `company_name` per schema recon — NOT `employer_name`.
  // The previous form caused HTTP 400 (column not found).
  const where = `upper(company_name) like '${escapeSoql(query)}%'`;
  return `${BASE}/${NON_SUBSCRIBER_RESOURCE}.json?$where=${encodeURIComponent(where)}&$limit=50`;
}

function isCurrentlyEffective(row: SubscriberRow): boolean {
  const now = Date.now();
  const eff = row.policy_effective_date ? Date.parse(row.policy_effective_date) : NaN;
  const exp = row.policy_expiration_date ? Date.parse(row.policy_expiration_date) : NaN;
  const cancel = row.cancellation_effective_date ? Date.parse(row.cancellation_effective_date) : NaN;
  if (!Number.isFinite(eff) || eff > now) return false;
  if (Number.isFinite(exp) && exp < now) return false;
  if (Number.isFinite(cancel) && cancel < now) return false;
  return true;
}

function pickNameField(row: NonSubscriberRow): string {
  // Real schema (per smoke recon): non-subscriber uses `company_name`.
  // Falling back to other guesses for resilience if schema drifts.
  const candidates: unknown[] = [
    (row as { company_name?: unknown }).company_name,
    (row as { employer_name?: unknown }).employer_name,
    (row as { insured_employer_name?: unknown }).insured_employer_name,
    (row as { business_name?: unknown }).business_name,
    (row as { name?: unknown }).name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase().includes('name') && typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown; rawText: string; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const rawText = await res.text();
    let body: unknown = [];
    try {
      body = JSON.parse(rawText);
    } catch {
      // Leave as []
    }
    return { status: res.status, body, rawText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 0, body: [], rawText: '', error: msg };
  }
}

function buildEvidence(
  finding_type: TrustFindingType,
  confidence: TrustConfidence,
  finding_summary: string,
  extracted_facts: Record<string, unknown>,
  rawText: string,
  duration_ms: number,
  query_sent: string,
): ScraperEvidence {
  return {
    source_key: SOURCE_KEY,
    finding_type,
    confidence,
    finding_summary,
    extracted_facts,
    query_sent,
    response_sha256: rawText ? sha256Hex(rawText) : null,
    response_snippet: rawText ? rawText.slice(0, 1500) : null,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}

export async function scrapeTxWcVerify(input: ScrapeTxWcVerifyInput): Promise<ScraperResult> {
  const overallStart = Date.now();
  const businessName = input.legalName;
  const attempts: AttemptRecord[] = [];
  const findings: ScraperEvidence[] = [];
  let subscriberFirstRowKeys: string[] | undefined;
  let nonSubscriberFirstRowKeys: string[] | undefined;
  let allRawText = '';

  // ── Subscriber dataset (authoritative for positive coverage) ──
  const subUrl = buildSubscriberUrl(businessName);
  const subFetch = await fetchJson(subUrl);
  allRawText = subFetch.rawText;
  const subRows: SubscriberRow[] = Array.isArray(subFetch.body) ? (subFetch.body as SubscriberRow[]) : [];
  attempts.push({
    dataset: 'subscriber',
    url: subUrl,
    status: subFetch.status,
    row_count: subRows.length,
    error: subFetch.error,
  });
  if (subRows.length > 0) subscriberFirstRowKeys = Object.keys(subRows[0]);

  if (subFetch.status === 0 || subFetch.status >= 500) {
    const duration_ms = Date.now() - overallStart;
    return [
      buildEvidence(
        'source_error',
        'low_inference',
        `Subscriber dataset unreachable: ${subFetch.error || `HTTP ${subFetch.status}`}`,
        { attempts },
        allRawText,
        duration_ms,
        subUrl,
      ),
    ];
  }

  const subMatches = subRows.filter((row) => {
    const candidate = (row.insured_employer_name || '').toString();
    return candidate.length > 0 && strictNameMatch({ query: businessName, candidate, mode: 'contains' });
  });

  // Dedup by employer + carrier + effective_date — historical snapshots in dataset
  const seen = new Set<string>();
  for (const row of subMatches) {
    const key = `${row.insured_employer_name}|${row.coverage_provider_name || ''}|${row.policy_effective_date || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const active = isCurrentlyEffective(row);
    const findingType: TrustFindingType = active ? 'insurance_active_wc' : 'insurance_lapsed';
    const conf: TrustConfidence = 'verified_structured';
    const summary = active
      ? `TX WC active: ${row.insured_employer_name} via ${row.coverage_provider_name || 'unknown carrier'} (policy ${row.policy_effective_date || '?'} to ${row.policy_expiration_date || '?'})`
      : `TX WC record not currently effective: ${row.insured_employer_name} via ${row.coverage_provider_name || 'unknown carrier'} (policy ${row.policy_effective_date || '?'} to ${row.policy_expiration_date || '?'}${row.cancellation_effective_date ? `, cancelled ${row.cancellation_effective_date}` : ''})`;

    findings.push(
      buildEvidence(
        findingType,
        conf,
        summary,
        {
          employer_name: row.insured_employer_name,
          carrier_name: row.coverage_provider_name,
          policy_effective_date: row.policy_effective_date,
          policy_expiration_date: row.policy_expiration_date,
          cancellation_effective_date: row.cancellation_effective_date,
          city: row.insured_employer_city,
          state: row.insured_employer_state,
        },
        subFetch.rawText,
        Date.now() - overallStart,
        subUrl,
      ),
    );

    if (active && row.coverage_provider_name) {
      findings.push(
        buildEvidence(
          'insurance_carrier_name',
          'verified_structured',
          `WC carrier: ${row.coverage_provider_name}`,
          {
            carrier_name: row.coverage_provider_name,
            employer_name: row.insured_employer_name,
          },
          subFetch.rawText,
          Date.now() - overallStart,
          subUrl,
        ),
      );
    }
  }

  // ── Non-subscriber dataset (authoritative for opt-out) ──
  const nonSubUrl = buildNonSubscriberUrl(businessName);
  const nonSubFetch = await fetchJson(nonSubUrl);
  const nonSubRows: NonSubscriberRow[] = Array.isArray(nonSubFetch.body) ? (nonSubFetch.body as NonSubscriberRow[]) : [];
  attempts.push({
    dataset: 'non_subscriber',
    url: nonSubUrl,
    status: nonSubFetch.status,
    row_count: nonSubRows.length,
    error: nonSubFetch.error,
  });
  if (nonSubRows.length > 0) nonSubscriberFirstRowKeys = Object.keys(nonSubRows[0]);

  const nonSubMatches = nonSubRows.filter((row) => {
    const candidate = pickNameField(row);
    return candidate.length > 0 && strictNameMatch({ query: businessName, candidate, mode: 'contains' });
  });

  for (const row of nonSubMatches) {
    findings.push(
      buildEvidence(
        'insurance_no_record',
        'verified_structured',
        `TX WC non-subscriber: employer registered as opted out of workers' compensation coverage`,
        { row, name_field_used: pickNameField(row) },
        nonSubFetch.rawText,
        Date.now() - overallStart,
        nonSubUrl,
      ),
    );
  }

  // ── Final composition ──
  if (findings.length === 0) {
    // Both datasets returned 200 but no strict-name matches. NOT
    // insurance_no_record — TDI has no record either way. Could be
    // unincorporated, sole prop, or out-of-state. Emit source_not_applicable.
    findings.push(
      buildEvidence(
        'source_not_applicable',
        'low_inference',
        `No TX WC record found in either TDI dataset (subscriber: ${subRows.length} rows scanned, non-subscriber: ${nonSubRows.length} rows scanned)`,
        {
          attempts,
          subscriber_first_row_keys: subscriberFirstRowKeys,
          non_subscriber_first_row_keys: nonSubscriberFirstRowKeys,
        },
        subFetch.rawText,
        Date.now() - overallStart,
        subUrl,
      ),
    );
  } else {
    // Attach diagnostic to first finding's extracted_facts
    findings[0] = {
      ...findings[0],
      extracted_facts: {
        ...findings[0].extracted_facts,
        _diagnostic: {
          attempts,
          subscriber_first_row_keys: subscriberFirstRowKeys,
          non_subscriber_first_row_keys: nonSubscriberFirstRowKeys,
        },
      },
    };
  }

  return findings.length === 1 ? findings[0] : findings;
}
