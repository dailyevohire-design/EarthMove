/**
 * USASpending.gov federal award search scraper.
 *
 * Free REST/JSON. No auth. Covers federal procurement awards (contracts)
 * to any entity in last 5 years.
 *
 * Coverage: ~5% of contractors do federal work. For everyone else:
 * federal_contractor_no_record (correct semantic, not a red flag).
 *
 * Returns one ScraperEvidence:
 *   - federal_contractor_active             if any current award (end date >= today)
 *   - federal_contractor_past_performance   if only past awards
 *   - federal_contractor_no_record          if no matches
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

const SOURCE_KEY = 'usaspending';
const SEARCH_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const TIMEOUT_MS = 15_000;
const COST_CENTS = 0;
const USER_AGENT = 'Earth Pro Connect LLC trust@earthmove.io';

export interface ScrapeUsaspendingInput {
  query_name: string;
  jurisdiction: string;
  contractor_id?: string;
  job_id?: string;
}

interface AwardResult {
  'Award ID'?: string;
  'Recipient Name'?: string;
  'Award Amount'?: number;
  'Awarding Agency'?: string;
  'Period of Performance Start Date'?: string;
  'Period of Performance Current End Date'?: string;
}

interface UsaspendingResponse {
  results?: AwardResult[];
  page_metadata?: { total?: number };
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeUsaspending(
  input: ScrapeUsaspendingInput,
): Promise<ScraperEvidence> {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());

  const body = {
    filters: {
      award_type_codes: ['A', 'B', 'C', 'D'],
      recipient_search_text: [input.query_name],
      time_period: [{
        start_date: fiveYearsAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      }],
    },
    fields: [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Awarding Agency',
      'Period of Performance Start Date',
      'Period of Performance Current End Date',
    ],
    page: 1,
    limit: 25,
  };

  const querySent = `POST ${SEARCH_URL} :: ${input.query_name}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  let response: Response;
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(`USASpending timeout after ${TIMEOUT_MS}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(
      `USASpending network error: ${err?.message ?? err}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timeoutId);

  if (response.status === 429) {
    throw new ScraperRateLimitError('USASpending rate limited', SOURCE_KEY, 60);
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new ScraperUpstreamError(
      `USASpending HTTP ${response.status} :: ${errBody.slice(0, 400)}`,
      SOURCE_KEY,
      response.status,
    );
  }

  const rawText = await response.text();
  let data: UsaspendingResponse;
  try {
    data = JSON.parse(rawText) as UsaspendingResponse;
  } catch {
    throw new ScraperUpstreamError(
      'USASpending non-JSON response',
      SOURCE_KEY,
      response.status,
    );
  }

  const duration_ms = Date.now() - start;
  const response_sha256 = sha256Hex(rawText);
  const response_snippet = rawText.slice(0, 1500);
  const results = data.results ?? [];
  const reportedTotal = data.page_metadata?.total ?? 0;

  if (results.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'federal_contractor_no_record',
      confidence: 'verified_structured',
      finding_summary: `USASpending: no federal contract awards found for "${input.query_name}" in last 5 years (residential GCs rarely have federal awards; absence is normal)`,
      extracted_facts: { query_name: input.query_name, total_count: 0 },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: COST_CENTS,
    };
  }
  // USASpending sometimes reports page_metadata.total=0 even when results
  // has matches — trust results.length as the floor and reportedTotal as a
  // hint when it's larger.
  const totalCount = Math.max(results.length, reportedTotal);

  const today = new Date().toISOString().split('T')[0];
  const activeAwards = results.filter(
    (r) => (r['Period of Performance Current End Date'] ?? '') >= today,
  );
  const totalAmount = results.reduce((s, r) => s + (r['Award Amount'] ?? 0), 0);
  const recipientNames = Array.from(
    new Set(results.map((r) => r['Recipient Name']).filter((x): x is string => Boolean(x))),
  );
  const agencies = Array.from(
    new Set(results.map((r) => r['Awarding Agency']).filter((x): x is string => Boolean(x))),
  );

  const isActive = activeAwards.length > 0;

  return {
    source_key: SOURCE_KEY,
    finding_type: isActive ? 'federal_contractor_active' : 'federal_contractor_past_performance',
    confidence: 'verified_structured',
    finding_summary: `USASpending: ${totalCount} federal contract${totalCount === 1 ? '' : 's'} totaling $${totalAmount.toLocaleString()} for "${recipientNames[0] ?? input.query_name}" (${isActive ? 'currently active' : 'past performance only'})`,
    extracted_facts: {
      query_name: input.query_name,
      total_count: totalCount,
      active_count: activeAwards.length,
      total_amount_usd: totalAmount,
      recipient_names_observed: recipientNames.slice(0, 5),
      awarding_agencies: agencies.slice(0, 5),
      sample_awards: results.slice(0, 3).map((r) => ({
        award_id: r['Award ID'],
        amount: r['Award Amount'],
        agency: r['Awarding Agency'],
        end_date: r['Period of Performance Current End Date'],
      })),
    },
    query_sent: querySent,
    response_sha256,
    response_snippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}
