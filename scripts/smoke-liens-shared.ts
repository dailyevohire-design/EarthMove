// scripts/smoke-liens-shared.ts
//
// No-network smoke for liens-shared. Run via:
//   pnpm exec tsx scripts/smoke-liens-shared.ts
//
// Covers normalizeBusinessName (4 cases), classifyLienDirection (5 cases),
// and scoreLienWindow (5 cases). Total 14 cases.

import {
  normalizeBusinessName,
  classifyLienDirection,
  scoreLienWindow,
  type LienWindow,
} from '../src/lib/groundcheck/scrapers/liens-shared'

type Case = {
  name: string
  run: () => { pass: boolean; got?: unknown }
}

function makeWindow(liens: LienWindow['liens'], counties: string[] = ['Denver']): LienWindow {
  return {
    source_key: 'co_county_recorder_liens',
    state_code: 'CO',
    searched_name: 'Bedrock Excavating',
    liens,
    counties_searched: counties,
    search_url: '',
    pulled_at: new Date().toISOString(),
    raw_response_sha256: '0'.repeat(64),
  }
}

const cases: Case[] = [
  {
    name: 'normalize: strips LLC suffix',
    run: () => {
      const got = normalizeBusinessName('Bedrock Excavating, LLC')
      return { pass: got === 'bedrock excavating', got }
    },
  },
  {
    name: 'normalize: strips Inc + Corp variants',
    run: () => {
      const a = normalizeBusinessName('Acme Construction Inc.')
      const b = normalizeBusinessName('Acme Construction Corp')
      const c = normalizeBusinessName('Acme Construction Corporation')
      const pass = a === 'acme construction' && b === 'acme construction' && c === 'acme construction'
      return { pass, got: { a, b, c } }
    },
  },
  {
    name: 'normalize: handles L.L.C. with periods + uppercase',
    run: () => {
      const got = normalizeBusinessName('BEDROCK EXCAVATING, L.L.C.')
      return { pass: got === 'bedrock excavating', got }
    },
  },
  {
    name: 'normalize: empty / null / undefined returns empty string',
    run: () => {
      const pass =
        normalizeBusinessName('') === '' &&
        normalizeBusinessName(null) === '' &&
        normalizeBusinessName(undefined) === ''
      return { pass }
    },
  },
  {
    name: 'direction: contractor as debtor -> against_contractor',
    run: () => {
      const d = classifyLienDirection(
        { claimant_name: 'Johnson Concrete LLC', debtor_name: 'Bedrock Excavating LLC' },
        'Bedrock Excavating',
      )
      return { pass: d === 'against_contractor', got: d }
    },
  },
  {
    name: 'direction: contractor as claimant -> by_contractor',
    run: () => {
      const d = classifyLienDirection(
        { claimant_name: 'Bedrock Excavating LLC', debtor_name: 'Smith Residential Trust' },
        'Bedrock Excavating',
      )
      return { pass: d === 'by_contractor', got: d }
    },
  },
  {
    name: 'direction: contractor in neither -> unknown',
    run: () => {
      const d = classifyLienDirection(
        { claimant_name: 'Random Sub LLC', debtor_name: 'Different Co' },
        'Bedrock Excavating',
      )
      return { pass: d === 'unknown', got: d }
    },
  },
  {
    name: 'direction: contractor in both -> unknown (structurally ambiguous)',
    run: () => {
      const d = classifyLienDirection(
        { claimant_name: 'Bedrock Excavating Corp', debtor_name: 'Bedrock Excavating LLC' },
        'Bedrock Excavating',
      )
      return { pass: d === 'unknown', got: d }
    },
  },
  {
    name: 'direction: substring overlap fires (Bedrock matches Bedrock Excavating Corp)',
    run: () => {
      const d = classifyLienDirection(
        { claimant_name: 'Some Vendor', debtor_name: 'Bedrock Excavating Corp' },
        'Bedrock Excavating',
      )
      return { pass: d === 'against_contractor', got: d }
    },
  },
  {
    name: 'score: 2 against (1 unresolved) -> mechanic_lien_against_contractor with correct totals',
    run: () => {
      const findings = scoreLienWindow(makeWindow([
        {
          filing_id: 'D1', filed_at: '2024-06-01', recorded_in_county: 'Denver',
          claimant_name: 'Johnson Concrete', debtor_name: 'Bedrock Excavating',
          amount: 15000, direction: 'against_contractor', release_recorded: false,
        },
        {
          filing_id: 'D2', filed_at: '2024-08-01', recorded_in_county: 'Denver',
          claimant_name: 'ACME Supply', debtor_name: 'Bedrock Excavating',
          amount: 5000, direction: 'against_contractor', release_recorded: true,
        },
      ]))
      const f = findings[0]
      const facts = f?.extracted_facts as Record<string, unknown>
      const pass =
        findings.length === 1 &&
        f.finding_type === 'mechanic_lien_against_contractor' &&
        facts.total === 2 &&
        facts.unresolved_count === 1 &&
        facts.total_claimed_amount === 20000
      return { pass, got: { count: findings.length, ft: f?.finding_type, facts } }
    },
  },
  {
    name: 'score: 2 by, 0 against -> mechanic_lien_by_contractor only',
    run: () => {
      const findings = scoreLienWindow(makeWindow([
        {
          filing_id: 'D3', filed_at: '2024-09-01', recorded_in_county: 'Denver',
          claimant_name: 'Bedrock Excavating', debtor_name: 'Client A',
          amount: 8000, direction: 'by_contractor',
        },
        {
          filing_id: 'D4', filed_at: '2024-10-01', recorded_in_county: 'Denver',
          claimant_name: 'Bedrock Excavating', debtor_name: 'Client B',
          amount: 12000, direction: 'by_contractor',
        },
      ]))
      const pass = findings.length === 1 && findings[0].finding_type === 'mechanic_lien_by_contractor'
      return { pass, got: findings.map(f => f.finding_type) }
    },
  },
  {
    name: 'score: mixed (1 against + 1 by) -> both findings emitted',
    run: () => {
      const findings = scoreLienWindow(makeWindow([
        {
          filing_id: 'D5', filed_at: '2024-01-01', recorded_in_county: 'Denver',
          claimant_name: 'Sub A', debtor_name: 'Bedrock Excavating',
          direction: 'against_contractor',
        },
        {
          filing_id: 'J1', filed_at: '2024-02-01', recorded_in_county: 'Jefferson',
          claimant_name: 'Bedrock Excavating', debtor_name: 'Client X',
          direction: 'by_contractor',
        },
      ], ['Denver', 'Jefferson']))
      const types = findings.map(f => f.finding_type).sort()
      const pass =
        findings.length === 2 &&
        types[0] === 'mechanic_lien_against_contractor' &&
        types[1] === 'mechanic_lien_by_contractor'
      return { pass, got: types }
    },
  },
  {
    name: 'score: empty result -> lien_clear with counties_searched preserved',
    run: () => {
      const findings = scoreLienWindow(makeWindow([], ['Denver', 'Adams', 'Jefferson', 'Arapahoe', 'Boulder']))
      const f = findings[0]
      const facts = f?.extracted_facts as { counties_searched: string[] }
      const pass =
        findings.length === 1 &&
        f.finding_type === 'lien_clear' &&
        facts.counties_searched.length === 5
      return { pass, got: { ft: f?.finding_type, count: facts.counties_searched?.length } }
    },
  },
  {
    name: 'score: examples capped at 5 even with 8 against-liens',
    run: () => {
      const liens = Array.from({ length: 8 }, (_, i) => ({
        filing_id: 'D' + (100 + i),
        filed_at: '2024-0' + ((i % 9) + 1) + '-01',
        recorded_in_county: 'Denver',
        claimant_name: 'Vendor ' + i,
        debtor_name: 'Bedrock Excavating',
        direction: 'against_contractor' as const,
        amount: 1000 * (i + 1),
      }))
      const findings = scoreLienWindow(makeWindow(liens))
      const facts = findings[0].extracted_facts as { total: number; examples: unknown[] }
      const pass = facts.total === 8 && facts.examples.length === 5
      return { pass, got: { total: facts.total, examples: facts.examples.length } }
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const { pass, got } = c.run()
  if (pass) {
    passed++
    console.log('  PASS  ' + c.name)
  } else {
    failed++
    console.log('  FAIL  ' + c.name)
    if (got !== undefined) console.log('        got:  ' + JSON.stringify(got))
  }
}

const verdict = failed === 0 ? 'PASS' : 'FAIL'
console.log('\n' + verdict + ': ' + passed + '/' + (passed + failed))
if (failed > 0) process.exit(1)
