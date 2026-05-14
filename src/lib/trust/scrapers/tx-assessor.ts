/**
 * Texas County Assessor scraper — v2 (DCAD WebForms).
 *
 * v1 (8c4756d) tried DCAD + TAD ArcGIS — all 24 endpoint attempts failed
 * cleanly. v2 pivots to DCAD's ASP.NET WebForms SearchOwner.aspx flow,
 * which terminal recon confirmed is reachable + captcha-free.
 *
 * Strategy:
 *   1. GET search page → extract __VIEWSTATE + __EVENTVALIDATION + __VIEWSTATEGENERATOR
 *   2. Discover the search input's actual name from the page DOM (DCAD uses
 *      `txtOwnerName` per recon; field discovery is defensive against changes)
 *   3. POST back with viewstate + owner name + `cmdSubmit=Search` button
 *   4. Parse results table HTML via defensive regex
 *   5. Captures every step in `attempts` array on failure for diagnostic
 *
 * TAD (Tarrant County) deliberately parked — confirmed captcha-protected.
 * Subsequent commits add HCAD, TCAD, BCAD via same shape.
 *
 * Coverage: Dallas County property ownership. Closes the fake-check scam
 * vector for half of DFW launch market #2.
 */

import { createHash } from 'node:crypto';
import {
  type ScraperEvidence,
  ScraperRateLimitError,
} from './types';
import { normalizeForExternalQuery } from './_helpers/normalize-for-query';

const SOURCE_KEY = 'tx_assessor';
const TIMEOUT_MS = 15_000;
const COST_CENTS = 0;
const USER_AGENT = 'Mozilla/5.0 (compatible; EarthProConnect-Trust/1.0; +trust@earthmove.io)';

const DCAD_BASE_URLS = [
  'https://www.dallascad.org',
  'https://dallascad.org',
  'https://www.dcad.org',
];
const DCAD_SEARCH_PATH = '/SearchOwner.aspx';

export interface ScrapeTxAssessorInput {
  query_name: string;
  jurisdiction: string;
  city?: string | null;
  contractor_id?: string;
  job_id?: string;
}

interface ParsedRow {
  account_number: string;
  owner_name: string;
  property_address: string;
  raw_cells: string[];
}

interface AttemptLog {
  step: string;
  url: string;
  status: number | string;
  note: string;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function scrapeTxAssessor(
  input: ScrapeTxAssessorInput,
): Promise<ScraperEvidence> {
  const normalized = normalizeForExternalQuery(input.query_name);
  const attempts: AttemptLog[] = [];
  const overallStart = Date.now();

  for (const baseUrl of DCAD_BASE_URLS) {
    const searchUrl = `${baseUrl}${DCAD_SEARCH_PATH}`;
    const result = await tryDcadEndpoint(searchUrl, normalized, attempts);
    if (result) return wrapEvidence(result, input, normalized, baseUrl, overallStart);
  }

  const duration_ms = Date.now() - overallStart;
  const attemptsSnippet = JSON.stringify(attempts).slice(0, 1500);

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    confidence: 'low_inference',
    finding_summary: `tx_assessor: all ${attempts.length} DCAD WebForms attempts failed across ${DCAD_BASE_URLS.length} hosts. See extracted_facts.attempts.`,
    extracted_facts: {
      query_name: input.query_name,
      normalized_query: normalized,
      city: input.city ?? null,
      attempts,
      attempt_count: attempts.length,
      strategy: 'dcad_webforms_v2',
    },
    query_sent: `multi-host DCAD WebForms probe :: ${attempts.length} attempts`,
    response_sha256: null,
    response_snippet: attemptsSnippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}

async function tryDcadEndpoint(
  searchUrl: string,
  normalizedName: string,
  attempts: AttemptLog[],
): Promise<{ rows: ParsedRow[]; html: string; durationMs: number } | null> {
  const stepStart = Date.now();

  const getController = new AbortController();
  const getTimeout = setTimeout(() => getController.abort(), TIMEOUT_MS);

  let getResp: Response;
  try {
    getResp = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: getController.signal,
      redirect: 'follow',
    });
  } catch (err: any) {
    clearTimeout(getTimeout);
    attempts.push({
      step: 'GET',
      url: searchUrl,
      status: err?.name === 'AbortError' ? 'timeout' : 'network',
      note: err?.message ?? String(err),
    });
    return null;
  }
  clearTimeout(getTimeout);

  if (!getResp.ok) {
    const body = await getResp.text().catch(() => '');
    attempts.push({
      step: 'GET',
      url: searchUrl,
      status: getResp.status,
      note: `HTTP ${getResp.status} :: ${body.slice(0, 200)}`,
    });
    return null;
  }

  // Use getSetCookie() (Node 18+) — falls back to .get() for older runtimes.
  // Splitting Set-Cookie on ',' fails because cookie expires dates contain commas.
  const setCookies: string[] =
    typeof (getResp.headers as any).getSetCookie === 'function'
      ? (getResp.headers as any).getSetCookie()
      : ((getResp.headers.get('set-cookie') ?? '').split(/,(?=\s*[a-zA-Z0-9_-]+=)/));
  const cookieJar = setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  const html = await getResp.text();

  if (
    /recaptcha|hcaptcha|cloudflare\s*challenge|access\s+denied|captcha|support\s*id/i.test(html)
  ) {
    attempts.push({
      step: 'GET',
      url: searchUrl,
      status: 200,
      note: 'captcha/WAF markers detected in response',
    });
    return null;
  }

  const viewstate = extractViewState(html);
  if (!viewstate.__VIEWSTATE) {
    attempts.push({
      step: 'GET',
      url: searchUrl,
      status: 200,
      note: `no __VIEWSTATE found in ${html.length}-char response`,
    });
    return null;
  }

  const searchInputName = findOwnerSearchInputName(html);
  if (!searchInputName) {
    attempts.push({
      step: 'GET',
      url: searchUrl,
      status: 200,
      note: 'no text/owner input field discovered in form',
    });
    return null;
  }

  const submitButtonName = findSubmitButtonName(html) ?? 'cmdSubmit';

  const postBody = new URLSearchParams();
  for (const [k, v] of Object.entries(viewstate)) postBody.set(k, v);
  postBody.set(searchInputName, normalizedName);
  postBody.set(submitButtonName, 'Search');

  const postController = new AbortController();
  const postTimeout = setTimeout(() => postController.abort(), TIMEOUT_MS);

  let postResp: Response;
  try {
    postResp = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: searchUrl,
        ...(cookieJar ? { Cookie: cookieJar } : {}),
      },
      body: postBody.toString(),
      signal: postController.signal,
      redirect: 'follow',
    });
  } catch (err: any) {
    clearTimeout(postTimeout);
    attempts.push({
      step: 'POST',
      url: searchUrl,
      status: err?.name === 'AbortError' ? 'timeout' : 'network',
      note: `${searchInputName}=${normalizedName} btn=${submitButtonName}: ${err?.message ?? err}`,
    });
    return null;
  }
  clearTimeout(postTimeout);

  if (postResp.status === 429) {
    throw new ScraperRateLimitError('DCAD rate limited', SOURCE_KEY, 60);
  }
  if (!postResp.ok) {
    const errBody = await postResp.text().catch(() => '');
    attempts.push({
      step: 'POST',
      url: searchUrl,
      status: postResp.status,
      note: `${searchInputName}=${normalizedName}: HTTP ${postResp.status} :: ${errBody.slice(0, 200)}`,
    });
    return null;
  }

  const resultsHtml = await postResp.text();

  if (
    /recaptcha|hcaptcha|cloudflare\s*challenge|access\s+denied|captcha|support\s*id/i.test(resultsHtml)
  ) {
    attempts.push({
      step: 'POST',
      url: searchUrl,
      status: 200,
      note: 'captcha/WAF markers in POST response (was missing from GET)',
    });
    return null;
  }

  const rows = parseDcadResultRows(resultsHtml);
  attempts.push({
    step: 'POST',
    url: searchUrl,
    status: 200,
    note: `parsed ${rows.length} rows (input=${searchInputName}, btn=${submitButtonName}, html=${resultsHtml.length} chars)`,
  });

  return { rows, html: resultsHtml, durationMs: Date.now() - stepStart };
}

function extractViewState(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const targets: Array<[string, RegExp]> = [
    ['__VIEWSTATE', /<input[^>]*name="__VIEWSTATE"[^>]*value="([^"]*)"/i],
    ['__VIEWSTATEGENERATOR', /<input[^>]*name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/i],
    ['__EVENTVALIDATION', /<input[^>]*name="__EVENTVALIDATION"[^>]*value="([^"]*)"/i],
    ['__EVENTTARGET', /<input[^>]*name="__EVENTTARGET"[^>]*value="([^"]*)"/i],
    ['__EVENTARGUMENT', /<input[^>]*name="__EVENTARGUMENT"[^>]*value="([^"]*)"/i],
  ];
  for (const [name, pattern] of targets) {
    const match = pattern.exec(html);
    fields[name] = match ? match[1] : '';
  }
  return fields;
}

function findOwnerSearchInputName(html: string): string | null {
  const inputPattern = /<input([^>]+)>/gi;
  const candidates: Array<{ name: string; priority: number }> = [];
  let match: RegExpExecArray | null;
  let safety = 0;

  while ((match = inputPattern.exec(html)) !== null && safety++ < 200) {
    const attrs = match[1];
    const nameMatch = /name=["']([^"']+)["']/i.exec(attrs);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (name.startsWith('__')) continue;

    const typeMatch = /type=["']?(\w+)["']?/i.exec(attrs);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
    if (['submit','button','hidden','image','checkbox','radio'].includes(type)) continue;

    let priority = 1;
    if (/owner/i.test(name)) priority += 10;
    if (/search/i.test(name)) priority += 5;
    if (/name/i.test(name)) priority += 3;
    candidates.push({ name, priority });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.name ?? null;
}

function findSubmitButtonName(html: string): string | null {
  const inputPattern = /<input([^>]+)>/gi;
  let match: RegExpExecArray | null;
  let safety = 0;

  while ((match = inputPattern.exec(html)) !== null && safety++ < 200) {
    const attrs = match[1];
    const typeMatch = /type=["']?(\w+)["']?/i.exec(attrs);
    if (!typeMatch || typeMatch[1].toLowerCase() !== 'submit') continue;
    const nameMatch = /name=["']([^"']+)["']/i.exec(attrs);
    if (!nameMatch) continue;
    return nameMatch[1];
  }
  return null;
}

function parseDcadResultRows(html: string): ParsedRow[] {
  // Scope to the actual results DataGrid. Without this, the global <tr>
  // scan picks up nav-bar rows + the form's own input echo as "matches".
  const tableMatch = /<table[^>]*id="SearchResults1_dgResults"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tableMatch) return [];

  const tableContent = tableMatch[1];
  const rows: ParsedRow[] = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let rowIdx = 0;
  let safety = 0;

  while ((trMatch = trPattern.exec(tableContent)) !== null && safety++ < 200) {
    const rowHtml = trMatch[1];
    rowIdx++;

    // DCAD's dgResults table layout:
    //   row 1 = pagination header ("< PREV  matches 1-10 of 56 properties.  NEXT >")
    //   row 2 = column headers (#, Property Address, City, Owner Name / Business Name, Total Value)
    //   rows 3+ = data rows
    if (rowIdx <= 2) continue;
    // Skip if cell tags are <th>, not <td>
    if (!/<td\b/i.test(rowHtml)) continue;

    const cells: string[] = [];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      const text = tdMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }

    if (cells.length < 4) continue;

    // Cells: [#, Property Address, City, Owner Name, Total Value]
    const [_idx, addr, city, owner, _value] = cells;
    if (!owner || !addr) continue;
    void _idx;
    void _value;

    // Account number is embedded in a link in the first cell — look for the
    // numeric account id pattern in the raw row HTML.
    const acctMatch = /(?:Account|account|id|aspx)[^a-zA-Z0-9]*([0-9]{8,14})/i.exec(rowHtml);
    const accountNumber = acctMatch?.[1] ?? '';

    rows.push({
      account_number: accountNumber,
      owner_name: owner,
      property_address: `${addr}, ${city}`.replace(/,\s*$/, ''),
      raw_cells: cells,
    });
  }

  return rows;
}

function wrapEvidence(
  result: { rows: ParsedRow[]; html: string; durationMs: number },
  input: ScrapeTxAssessorInput,
  normalized: string,
  baseUrl: string,
  overallStart: number,
): ScraperEvidence {
  const querySent = `POST ${baseUrl}${DCAD_SEARCH_PATH} :: owner=${normalized}`;
  const duration_ms = Date.now() - overallStart;
  const response_sha256 = sha256Hex(result.html);
  const response_snippet = result.html.slice(0, 1500);

  if (result.rows.length === 0) {
    return {
      source_key: SOURCE_KEY,
      finding_type: 'business_not_found',
      confidence: 'verified_structured',
      finding_summary: `DCAD: no parcels found under "${input.query_name}" in Dallas County`,
      extracted_facts: {
        query_name: input.query_name,
        district: 'DCAD',
        county: 'Dallas',
        jurisdiction: 'TX',
        match_count: 0,
        html_length: result.html.length,
        html_head: result.html.slice(0, 600),
      },
      query_sent: querySent,
      response_sha256,
      response_snippet,
      duration_ms,
      cost_cents: COST_CENTS,
    };
  }

  const top = result.rows[0];
  const ownerUpper = top.owner_name.toUpperCase();
  const isEntity = /\b(LLC|INC|CORP|LTD|LP|HOLDINGS|TRUST|COMPANY|CO\b|GROUP|PARTNERS)\b/i.test(ownerUpper);

  return {
    source_key: SOURCE_KEY,
    finding_type: 'business_active',
    confidence: 'verified_structured',
    finding_summary: `DCAD: ${result.rows.length} parcel${result.rows.length === 1 ? '' : 's'} owned by "${top.owner_name}" in Dallas County${isEntity ? '' : ' (non-entity owner)'}`,
    extracted_facts: {
      query_name: input.query_name,
      district: 'DCAD',
      county: 'Dallas',
      jurisdiction: 'TX',
      match_count: result.rows.length,
      is_entity: isEntity,
      top_owner: top.owner_name,
      top_account: top.account_number,
      top_address: top.property_address,
      additional_matches: result.rows.slice(1, 5).map((r) => ({
        account: r.account_number,
        owner: r.owner_name,
        address: r.property_address,
      })),
    },
    query_sent: querySent,
    response_sha256,
    response_snippet,
    duration_ms,
    cost_cents: COST_CENTS,
  };
}
