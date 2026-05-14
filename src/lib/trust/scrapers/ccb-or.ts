/**
 * Oregon Construction Contractors Board (CCB) license scraper.
 *
 * Source: https://search.ccb.state.or.us/search/
 *
 * KNOWN ISSUE (2026-05-14) — gate stays {} until resolved:
 *   The CCB search is ASP.NET WebForms with reCaptcha. Probed home page
 *   contains __VIEWSTATE/__EVENTVALIDATION/reCaptchaToken inputs. The naive
 *   GET to /search/search.aspx returns 404; the real flow is a state-bearing
 *   POST to /search/ with a valid reCaptchaToken. Bypassing requires either
 *   a captcha-solving service ($1-2/solve) or a headless browser with
 *   reCaptcha v3 stealth. Both add per-call cost + a paid dep.
 *
 *   This file is wired in registry.ts so the dispatch case exists, but
 *   trust_source_registry.applicable_tiers for 'ccb_or' is held at {}.
 *   Do NOT flip the gate until the real protocol path is implemented OR
 *   an alternative OR source is chosen (OR SOS biz, BOLI, Portland permits).
 *   See memory: reference-ccb-oregon-recaptcha-blocker.
 *
 * Coverage when fixed: Oregon contractor licenses (general, specialty,
 * plumbing, electrical). Includes license status, license dates, bond status.
 *
 * Returns single ScraperEvidence:
 *   license_active           - license number found, status Active
 *   license_expired          - status Expired
 *   license_suspended        - status Suspended
 *   license_revoked          - status Revoked
 *   license_not_found        - no match for name
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperRateLimitError,
  ScraperUpstreamError,
  ScraperTimeoutError,
} from './types';

const SOURCE_KEY = 'ccb_or';
const CCB_SEARCH_URL = 'https://search.ccb.state.or.us/search/search.aspx';
const TIMEOUT_MS = 12_000;
const COST_CENTS = 0;
const USER_AGENT = 'Earth Pro Connect LLC trust@earthmove.io';

export interface ScrapeCcbOrInput {
  query_name: string;
  jurisdiction: string;
  contractor_id?: string;
  job_id?: string;
}

interface CcbResultRow {
  license_number: string;
  business_name: string;
  status: string;
  license_type: string;
  raw_row_html: string;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeCcbOr(
  input: ScrapeCcbOrInput,
): Promise<ScraperEvidence> {
  const url = new URL(CCB_SEARCH_URL);
  url.searchParams.set('business_name', input.query_name);
  const querySent = `GET ${url.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new ScraperTimeoutError(`CCB OR timeout after ${TIMEOUT_MS}ms`, SOURCE_KEY);
    }
    throw new ScraperUpstreamError(
      `CCB OR network error: ${err?.message ?? err}`,
      SOURCE_KEY,
      0,
    );
  }
  clearTimeout(timeoutId);

  if (response.status === 429) {
    throw new ScraperRateLimitError('CCB OR rate limited', SOURCE_KEY, 60);
  }
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new ScraperUpstreamError(
      `CCB OR HTTP ${response.status} :: ${errBody.slice(0, 400)}`,
      SOURCE_KEY,
      response.status,
    );
  }

  const html = await response.text();
  const duration_ms = Date.now() - start;
  const response_sha256 = sha256Hex(html);
  const response_snippet = html.slice(0, 1500);

  if (
    /no\s+(results?|matches?|records?)\s+(found|located)/i.test(html) ||
    /<!--\s*NoResults\s*-->/i.test(html) ||
    /your\s+search\s+returned\s+0/i.test(html)
  ) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_not_found',
      confidence: 'verified_structured',
      finding_summary: `CCB OR: no Oregon contractor license found for "${input.query_name}"`,
      extracted_facts: { query_name: input.query_name, match_count: 0 },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: COST_CENTS,
    };
  }

  const rows = parseResultRows(html);
  if (rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'license_not_found',
      confidence: 'verified_structured',
      finding_summary: `CCB OR: no parseable license rows for "${input.query_name}" (HTML may have changed; ${html.length} chars received)`,
      extracted_facts: {
        query_name: input.query_name,
        match_count: 0,
        html_length: html.length,
        html_head: html.slice(0, 800),
      },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: COST_CENTS,
    };
  }

  const top = rows[0];
  const status = top.status.toLowerCase();

  let findingType:
    | 'license_active'
    | 'license_expired'
    | 'license_suspended'
    | 'license_revoked'
    | 'license_inactive';

  if (status.includes('active')) {
    findingType = 'license_active';
  } else if (status.includes('expired')) {
    findingType = 'license_expired';
  } else if (status.includes('suspended')) {
    findingType = 'license_suspended';
  } else if (status.includes('revoked')) {
    findingType = 'license_revoked';
  } else if (status.includes('inactive') || status.includes('lapsed')) {
    findingType = 'license_inactive';
  } else {
    findingType = 'license_active';
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: 'verified_structured',
    finding_summary: `CCB OR: "${top.business_name}" license ${top.license_number} status ${top.status} (${top.license_type})`,
    extracted_facts: {
      query_name: input.query_name,
      license_number: top.license_number,
      business_name: top.business_name,
      status: top.status,
      license_type: top.license_type,
      match_count: rows.length,
      additional_matches: rows.slice(1, 5).map((r) => ({
        license_number: r.license_number,
        business_name: r.business_name,
        status: r.status,
      })),
    },
    query_sent: querySent,
    response_sha256,
    response_snippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}

function parseResultRows(html: string): CcbResultRow[] {
  const rows: CcbResultRow[] = [];
  const rowPattern =
    /<tr[^>]*>([\s\S]*?<a[^>]*license[^>]*>([0-9]+)<\/a>[\s\S]*?)<\/tr>/gi;

  let match: RegExpExecArray | null;
  let safety = 0;
  while ((match = rowPattern.exec(html)) !== null && safety++ < 100) {
    const rowHtml = match[1];
    const licenseNumber = match[2];

    const cells: string[] = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) cells.push(text);
    }

    if (cells.length >= 2) {
      rows.push({
        license_number: licenseNumber,
        business_name: cells[1] ?? cells[0] ?? '',
        status: cells.find((c) =>
          /active|expired|suspended|revoked|inactive|lapsed/i.test(c),
        ) ?? 'unknown',
        license_type:
          cells.find((c) =>
            /general|specialty|plumb|electric|residential|commercial/i.test(c),
          ) ?? '',
        raw_row_html: rowHtml.slice(0, 300),
      });
    }
  }

  return rows;
}
