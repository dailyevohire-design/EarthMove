// scripts/smoke-bond-extractor.ts
//
// Heuristic-only smoke (no network). Validates BondInfo extraction from both
// CO DORA JSON shapes and TX TDLR HTML fixtures, plus the bondToEvidence
// mapping. Run via:
//   pnpm exec tsx scripts/smoke-bond-extractor.ts

import {
  extractBondFromCoDoraJson,
  extractBondFromTxTdlrHtml,
  bondToEvidence,
} from '../src/lib/groundcheck/scrapers/bond-extractor'

type Case = {
  name: string
  run: () => { pass: boolean; got?: unknown }
}

const cases: Case[] = [
  {
    name: 'CO DORA: not required → bond_not_required',
    run: () => {
      const r = extractBondFromCoDoraJson({ BondRequired: false })
      const ev = bondToEvidence(r, 'co_dora')
      const pass = r.required === false && r.status === 'not_required' && ev?.finding_type === 'bond_not_required'
      return { pass, got: { req: r.required, status: r.status, ft: ev?.finding_type } }
    },
  },
  {
    name: 'CO DORA: active in force → bond_active with surety',
    run: () => {
      const r = extractBondFromCoDoraJson({
        BondRequired: true,
        BondStatus: 'In Force',
        SuretyCompany: 'Western Surety',
        BondAmount: 15000,
        BondEffectiveDate: '2025-03-01',
        BondExpirationDate: '2027-03-01',
        BondClaims: [],
      })
      const ev = bondToEvidence(r, 'co_dora')
      const pass =
        r.status === 'active' &&
        ev?.finding_type === 'bond_active' &&
        r.surety_name === 'Western Surety' &&
        r.bond_amount === 15000
      return { pass, got: { status: r.status, surety: r.surety_name, amount: r.bond_amount, ft: ev?.finding_type } }
    },
  },
  {
    name: 'CO DORA: claim filed → bond_claimed_against (overrides status text)',
    run: () => {
      const r = extractBondFromCoDoraJson({
        BondRequired: true,
        BondStatus: 'In Force',
        BondClaims: [{ FiledDate: '2025-06-15', Amount: 8000, Resolution: 'Paid' }],
      })
      const ev = bondToEvidence(r, 'co_dora')
      const pass =
        r.status === 'claimed_against' &&
        ev?.finding_type === 'bond_claimed_against' &&
        r.claim_count === 1
      return { pass, got: { status: r.status, count: r.claim_count, ft: ev?.finding_type } }
    },
  },
  {
    name: 'CO DORA: lapsed → bond_lapsed',
    run: () => {
      const r = extractBondFromCoDoraJson({
        BondRequired: true,
        BondStatus: 'Lapsed',
        BondExpirationDate: '2024-08-15',
      })
      const ev = bondToEvidence(r, 'co_dora')
      const pass = r.status === 'lapsed' && ev?.finding_type === 'bond_lapsed'
      return { pass, got: { status: r.status, ft: ev?.finding_type } }
    },
  },
  {
    name: 'CO DORA: snake_case fields → same result',
    run: () => {
      const r = extractBondFromCoDoraJson({
        bond_required: true,
        bond_status: 'effective',
        surety_name: 'Liberty Mutual',
      })
      const pass = r.status === 'active' && r.surety_name === 'Liberty Mutual'
      return { pass, got: { status: r.status, surety: r.surety_name } }
    },
  },
  {
    name: 'CO DORA: null/garbage input → status=unknown, required=false',
    run: () => {
      const r1 = extractBondFromCoDoraJson(null)
      const r2 = extractBondFromCoDoraJson('not an object')
      const pass = r1.status === 'unknown' && r1.required === false && r2.status === 'unknown'
      return { pass, got: { r1: r1.status, r2: r2.status } }
    },
  },
  {
    name: 'TX TDLR HTML: not required → bond_not_required',
    run: () => {
      const html = '<tr><td>Bond Required:</td><td>No</td></tr>'
      const r = extractBondFromTxTdlrHtml(html)
      const ev = bondToEvidence(r, 'tx_tdlr')
      const pass = r.required === false && ev?.finding_type === 'bond_not_required'
      return { pass, got: { req: r.required, ft: ev?.finding_type } }
    },
  },
  {
    name: 'TX TDLR HTML: active → bond_active with amount + surety + expiration',
    run: () => {
      const html = `
        <tr><td>Bond Required:</td><td>Yes</td></tr>
        <tr><td>Bond Status:</td><td>Active</td></tr>
        <tr><td>Bond Amount:</td><td>$10,000</td></tr>
        <tr><td>Surety Company:</td><td>Travelers Casualty</td></tr>
        <tr><td>Bond Expiration:</td><td>2027-04-15</td></tr>
      `
      const r = extractBondFromTxTdlrHtml(html)
      const ev = bondToEvidence(r, 'tx_tdlr')
      const pass =
        r.status === 'active' &&
        r.bond_amount === 10000 &&
        r.surety_name === 'Travelers Casualty' &&
        r.expiration_date === '2027-04-15' &&
        ev?.finding_type === 'bond_active'
      return { pass, got: { status: r.status, amount: r.bond_amount, surety: r.surety_name, exp: r.expiration_date } }
    },
  },
  {
    name: 'TX TDLR HTML: cancelled → bond_lapsed',
    run: () => {
      const html = `
        <tr><td>Bond Required:</td><td>Yes</td></tr>
        <tr><td>Bond Status:</td><td>Cancelled</td></tr>
      `
      const r = extractBondFromTxTdlrHtml(html)
      const ev = bondToEvidence(r, 'tx_tdlr')
      const pass = r.status === 'lapsed' && ev?.finding_type === 'bond_lapsed'
      return { pass, got: { status: r.status, ft: ev?.finding_type } }
    },
  },
  {
    name: 'TX TDLR HTML: structurally ambiguous → unknown → null evidence row',
    run: () => {
      const html = '<tr><td>Bond Required:</td><td>Yes</td></tr>'
      const r = extractBondFromTxTdlrHtml(html)
      const ev = bondToEvidence(r, 'tx_tdlr')
      const pass = r.status === 'unknown' && ev === null
      return { pass, got: { status: r.status, ev_is_null: ev === null } }
    },
  },
  {
    name: 'bondToEvidence: status=unknown → returns null (no evidence written)',
    run: () => {
      const ev = bondToEvidence({ required: true, status: 'unknown' }, 'co_dora')
      return { pass: ev === null, got: ev }
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const { pass, got } = c.run()
  if (pass) {
    passed++
    console.log(`  PASS  ${c.name}`)
  } else {
    failed++
    console.log(`  FAIL  ${c.name}`)
    if (got !== undefined) console.log(`        got:  ${JSON.stringify(got)}`)
  }
}

const verdict = failed === 0 ? 'PASS' : 'FAIL'
console.log(`\n${verdict}: ${passed}/${passed + failed}`)
if (failed > 0) process.exit(1)
