import { createHash } from 'node:crypto';
import type { ScraperEvidence } from './types';

/**
 * Shared normalization for permit-history scrapers (Denver, Dallas, Fort Worth
 * pending). Each jurisdiction's scraper:
 *   1. Fetches raw permit rows from its data portal
 *   2. Maps raw rows → PermitRecord via a jurisdiction-specific adapter
 *   3. Aggregates via computeSignals
 *   4. Emits ScraperEvidence[] via emitFindings
 *
 * Always produces 1 informational permit_history_clean row plus 0..N flag rows.
 */

export interface PermitRecord {
  permit_number: string;
  issued_date: string;        // ISO 8601 date (YYYY-MM-DD)
  work_class: string;
  address: string;
  status: string;
  contractor_name: string | null;
}

export interface PermitSignals {
  total_permits: number;
  permit_count_last_12mo: number;
  permits_5y: number;
  most_recent_permit_date: string | null;       // ISO 8601 date or null
  work_class_distribution: Record<string, number>;
}

/**
 * Drop adapter-rejected rows + dedupe by permit_number. Stable input order.
 */
export function normalizePermits<T>(
  raw: T[],
  adapter: (r: T) => PermitRecord | null,
): PermitRecord[] {
  const seen = new Set<string>();
  const out: PermitRecord[] = [];
  for (const r of raw) {
    const norm = adapter(r);
    if (!norm) continue;
    if (!norm.permit_number) continue;
    if (seen.has(norm.permit_number)) continue;
    seen.add(norm.permit_number);
    out.push(norm);
  }
  return out;
}

/**
 * Aggregate volume + recency signals from a normalized permit list.
 * `asOf` is injectable so tests can pin the clock.
 */
export function computeSignals(permits: PermitRecord[], asOf: Date): PermitSignals {
  const ms12 = 365 * 24 * 60 * 60 * 1000;
  const ms5y = 5 * ms12;
  const now = asOf.getTime();

  let last12 = 0;
  let last5 = 0;
  let mostRecent: string | null = null;
  let mostRecentMs = -Infinity;
  const dist: Record<string, number> = {};

  for (const p of permits) {
    const t = new Date(p.issued_date).getTime();
    if (Number.isNaN(t)) continue;
    const age = now - t;
    if (age <= ms12) last12 += 1;
    if (age <= ms5y) last5 += 1;
    if (t > mostRecentMs) {
      mostRecentMs = t;
      mostRecent = p.issued_date;
    }
    const cls = p.work_class || 'unknown';
    dist[cls] = (dist[cls] ?? 0) + 1;
  }

  return {
    total_permits: permits.length,
    permit_count_last_12mo: last12,
    permits_5y: last5,
    most_recent_permit_date: mostRecent,
    work_class_distribution: dist,
  };
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function canonicalSha(permits: PermitRecord[]): string {
  // Deterministic canonical form: sorted by permit_number, JSON-stringified
  // with stable key order. Same permit list → same hash → idempotent insert
  // via append_trust_evidence (job_id, source_key, response_sha256).
  const sorted = [...permits].sort((a, b) => a.permit_number.localeCompare(b.permit_number));
  const compact = sorted.map((p) =>
    JSON.stringify({
      permit_number: p.permit_number,
      issued_date: p.issued_date,
      work_class: p.work_class,
      address: p.address,
    }),
  );
  return sha256Hex('[' + compact.join(',') + ']');
}

interface EmitContext {
  source_key: string;
  jurisdiction: string;
  contractor_name: string;
  asOf: Date;
}

/**
 * Build ScraperEvidence array from normalized permits + computed signals.
 * Always emits 1 informational permit_history_clean row; conditionally adds
 * flag rows based on the volume/recency thresholds.
 */
export function emitFindings(
  permits: PermitRecord[],
  signals: PermitSignals,
  ctx: EmitContext,
): ScraperEvidence[] {
  const sha = canonicalSha(permits);
  const sample = permits.slice(0, 5).map((p) => p.permit_number);
  const distinctAddresses = new Set<string>();
  for (const p of permits) {
    const a = (p.address ?? '').trim().toUpperCase();
    if (a) distinctAddresses.add(a);
  }
  const addressMatchCount = distinctAddresses.size;
  const out: ScraperEvidence[] = [];

  // Always — informational row with full counts in extracted_facts.
  out.push({
    source_key: ctx.source_key,
    finding_type: 'permit_history_clean',
    confidence: 'verified_structured',
    finding_summary: `${ctx.jurisdiction}: ${signals.permits_5y} permits in last 5 years; most recent ${signals.most_recent_permit_date ?? 'none on record'}`,
    extracted_facts: {
      jurisdiction: ctx.jurisdiction,
      source_key: ctx.source_key,
      contractor_query: ctx.contractor_name,
      total_permits: signals.total_permits,
      permit_count_last_12mo: signals.permit_count_last_12mo,
      permits_5y: signals.permits_5y,
      most_recent_permit_date: signals.most_recent_permit_date,
      address_match_count: addressMatchCount,
      work_class_distribution: signals.work_class_distribution,
      sample_permit_numbers: sample,
    },
    query_sent: null,
    response_sha256: sha,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  });

  // Recency context: how recent is most_recent?
  const ms6m = 6 * 30 * 24 * 60 * 60 * 1000;
  const ms18m = 18 * 30 * 24 * 60 * 60 * 1000;
  const recentMs = signals.most_recent_permit_date
    ? ctx.asOf.getTime() - new Date(signals.most_recent_permit_date).getTime()
    : Infinity;

  // Robust: high volume + currently active (most recent within 6mo)
  if (signals.permits_5y >= 20 && recentMs <= ms6m) {
    out.push({
      source_key: ctx.source_key,
      finding_type: 'permit_history_robust',
      confidence: 'verified_structured',
      finding_summary: `${ctx.jurisdiction}: robust permit history — ${signals.permits_5y} permits in 5yr, most recent within 6mo`,
      extracted_facts: {
        jurisdiction: ctx.jurisdiction,
        threshold: 'permits_5y>=20 AND most_recent<=6mo',
        permits_5y: signals.permits_5y,
        most_recent_permit_date: signals.most_recent_permit_date,
      },
      query_sent: null,
      response_sha256: sha256Hex(`robust|${sha}`),
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    });
  } else if (signals.permits_5y < 5) {
    // Low volume — only flag when robust gate isn't met
    out.push({
      source_key: ctx.source_key,
      finding_type: 'permit_history_low',
      confidence: 'verified_structured',
      finding_summary: `${ctx.jurisdiction}: low permit volume — ${signals.permits_5y} permits in 5 years (under 5-permit threshold)`,
      extracted_facts: {
        jurisdiction: ctx.jurisdiction,
        threshold: 'permits_5y<5',
        permits_5y: signals.permits_5y,
      },
      query_sent: null,
      response_sha256: sha256Hex(`low|${sha}`),
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    });
  }

  // Stale: most recent permit > 18mo ago (independent of volume)
  if (signals.most_recent_permit_date && recentMs > ms18m) {
    out.push({
      source_key: ctx.source_key,
      finding_type: 'permit_history_stale',
      confidence: 'verified_structured',
      finding_summary: `${ctx.jurisdiction}: stale permit history — most recent permit ${signals.most_recent_permit_date}, over 18 months old`,
      extracted_facts: {
        jurisdiction: ctx.jurisdiction,
        threshold: 'most_recent_permit_date older than 18mo',
        most_recent_permit_date: signals.most_recent_permit_date,
        days_since_most_recent: Math.floor(recentMs / (24 * 60 * 60 * 1000)),
      },
      query_sent: null,
      response_sha256: sha256Hex(`stale|${sha}`),
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    });
  }

  return out;
}

/**
 * Emit a single unverified informational row when the upstream portal is
 * unreachable. Scrapers prefer this over throwing so the chain still records
 * "we tried, here's why we have no data" for the contractor.
 */
export function emitFetchErrorFinding(args: {
  source_key: string;
  jurisdiction: string;
  contractor_name: string;
  error: unknown;
}): ScraperEvidence {
  const msg = args.error instanceof Error ? args.error.message : String(args.error);
  return {
    source_key: args.source_key,
    finding_type: 'permit_history_clean',
    confidence: 'unverified',
    finding_summary: `${args.jurisdiction}: portal unreachable`,
    extracted_facts: {
      jurisdiction: args.jurisdiction,
      source_key: args.source_key,
      contractor_query: args.contractor_name,
      error_message: msg.slice(0, 500),
      error_class: args.error instanceof Error ? args.error.constructor.name : 'unknown',
    },
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  };
}
