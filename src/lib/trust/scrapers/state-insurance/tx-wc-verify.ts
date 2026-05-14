// Texas workers-compensation coverage verification.
//
// Source: TX DWC (Department of Workers' Compensation) public employer
// verification at tdi.texas.gov. Free, no auth, no captcha as of 2026-05.
//
// This is the FIRST scraper to populate insurance_* finding_types. The schema
// has had those finding_types (insurance_active_wc / insurance_lapsed /
// insurance_no_record / insurance_below_minimum / insurance_carrier_name)
// since the original CHECK constraint was authored — they've been waiting
// for a source to emit them.
//
// Why this matters: TX law requires WC coverage for most construction work,
// and a homeowner whose contractor lacks WC can be personally liable when a
// worker is injured on their property. "Are they insured?" is the universal
// homeowner question and Groundcheck has not answered it until now.
//
// Pattern H defensive multi-strategy. If endpoint URL or response shape has
// drifted, the smoke output IS the recon for v2.

import { fetchWithCapture, strictNameMatch, type AttemptRecord } from '../lib/html-scraper-helpers';
import * as cheerio from 'cheerio';

const SOURCE_KEY = 'tx_wc_verify' as const;

export interface TxWcVerifyResult {
  source_key: typeof SOURCE_KEY;
  finding_type:
    | 'insurance_active_wc'
    | 'insurance_lapsed'
    | 'insurance_no_record'
    | 'insurance_below_minimum'
    | 'source_not_applicable'
    | 'source_error';
  finding_summary: string;
  extracted_facts: Record<string, unknown>;
  response_snippet: string;
}

export async function scrapeTxWcVerify(contractorName: string): Promise<TxWcVerifyResult> {
  const attempts: AttemptRecord[] = [];

  // Strategy 1: TDI Coverage Verification index (landing page, often the
  // canonical doc URL even when search lives elsewhere)
  const r1 = await fetchWithCapture(
    'https://www.tdi.texas.gov/wc/employer/index.html',
    {
      strategy: 'tdi_employer_index_get',
      method: 'GET',
    },
  );
  attempts.push(r1.attempt);

  // Strategy 2: Direct search by name on the verification servlet (legacy
  // .do endpoint — may have moved)
  const r2 = await fetchWithCapture(
    `https://apps.tdi.state.tx.us/inter/coverage/SearchByEmployer.do?employerName=${encodeURIComponent(contractorName)}`,
    {
      strategy: 'searchbyemployer_get',
      method: 'GET',
    },
  );
  attempts.push(r2.attempt);

  // Strategy 3: Modern verify endpoint variant
  const r3 = await fetchWithCapture(
    'https://apps.tdi.state.tx.us/inter/coverage/SearchEmployer',
    {
      strategy: 'searchemployer_post',
      method: 'POST',
      body: new URLSearchParams({
        employerName: contractorName,
        searchType: 'name',
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  attempts.push(r3.attempt);

  const body = r2.ok ? r2.body : r3.ok ? r3.body : r1.ok ? r1.body : '';

  if (body && body.length > 200) {
    const $ = cheerio.load(body);
    const matches: Array<{
      employer: string;
      carrier: string;
      effective_date: string;
      cancellation_date: string;
      status: string;
    }> = [];

    // Try common result-table selectors; recon needed if none match
    $('table.results tbody tr, table#searchResults tbody tr, table.dataTable tbody tr, table tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const employer = $(cells[0]).text().trim();
        const carrier = cells.length > 1 ? $(cells[1]).text().trim() : '';
        const effective_date = cells.length > 2 ? $(cells[2]).text().trim() : '';
        const cancellation_date = cells.length > 3 ? $(cells[3]).text().trim() : '';
        const status_text = cells.length > 4 ? $(cells[4]).text().trim() : '';
        if (
          employer &&
          employer.toLowerCase() !== 'employer name' &&
          strictNameMatch({ query: contractorName, candidate: employer, mode: 'contains' })
        ) {
          matches.push({ employer, carrier, effective_date, cancellation_date, status: status_text });
        }
      }
    });

    if (matches.length > 0) {
      const top = matches[0];
      const cancelled = top.cancellation_date && top.cancellation_date.length > 0;
      const finding_type: TxWcVerifyResult['finding_type'] = cancelled
        ? 'insurance_lapsed'
        : 'insurance_active_wc';
      return {
        source_key: SOURCE_KEY,
        finding_type,
        finding_summary: `TX DWC: workers-comp coverage for "${top.employer}" via carrier "${top.carrier || 'unknown'}", effective ${top.effective_date || 'unknown'}${cancelled ? `, cancelled ${top.cancellation_date}` : ' (active)'}`,
        extracted_facts: {
          matches,
          top_match: top,
          attempts,
          carrier_name: top.carrier,
          effective_date: top.effective_date,
          cancellation_date: top.cancellation_date,
        },
        response_snippet: body.slice(0, 500),
      };
    }

    return {
      source_key: SOURCE_KEY,
      finding_type: 'insurance_no_record',
      finding_summary: `TX DWC: no workers-comp coverage record matching "${contractorName}". Absence is meaningful — TX requires WC for most construction work, though sole proprietors and certain trades are exempt.`,
      extracted_facts: { attempts },
      response_snippet: body.slice(0, 500),
    };
  }

  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error',
    finding_summary: `TX DWC: ${attempts.map((a) => `${a.strategy}=${a.http_status ?? a.error}`).join('; ')}`,
    extracted_facts: { attempts },
    response_snippet: '',
  };
}
