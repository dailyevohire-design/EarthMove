import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import type { CollectionsCase } from '@/lib/collections/types'
import { renderCODemandLetter }    from '@/lib/collections/templates/co/demand-letter'
import { renderCONoticeOfIntent }  from '@/lib/collections/templates/co/notice-of-intent'
import { renderCOMechanicsLien }   from '@/lib/collections/templates/co/mechanics-lien'
import { renderTXDemandLetter }    from '@/lib/collections/templates/tx/demand-letter'
import { renderTXPreLienNotice }   from '@/lib/collections/templates/tx/pre-lien-notice'
import { renderTXLienAffidavit }   from '@/lib/collections/templates/tx/lien-affidavit'

function makeCase(overrides: Partial<CollectionsCase> = {}): CollectionsCase {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000099',
    status: 'paid',
    state_code: 'CO',
    contractor_role: 'original_contractor',
    property_type: 'commercial',
    is_homestead: false,
    claimant_name: 'Acme Excavation LLC',
    claimant_address: '123 Industrial Way\nDenver, CO 80202',
    claimant_phone: '555-0100',
    claimant_email: 'ops@acme-ex.test',
    claimant_entity_type: 'llc',
    respondent_name: 'BigBuild Developers Inc.',
    respondent_address: '4900 Office Pkwy\nDenver, CO 80202',
    respondent_relationship: 'general_contractor',
    property_street_address: '900 Market St',
    property_city: 'Denver',
    property_state: 'CO',
    property_zip: '80202',
    property_county: 'denver',
    property_legal_description: 'Lot 4, Block 3, Downtown Subdivision',
    property_owner_name: 'Market St Owner LLC',
    property_owner_address: '1 Owner Plz, Denver, CO 80202',
    owner_lookup_method: 'manual',
    owner_lookup_source_url: null,
    original_contract_signed_date: null,
    original_contract_both_spouses_signed: null,
    work_description: 'Excavation, grading, and haul-off of 12,000 cubic yards of fill dirt for the site prep of the new office building.',
    first_day_of_work: '2026-01-05',
    last_day_of_work:  '2026-03-20',
    amount_owed_cents: 4750000,
    pre_lien_notices_sent: [],
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    paid_at: null,
    amount_paid_cents: null,
    documents_generated_at: null,
    demand_letter_storage_path: null,
    pre_lien_notice_storage_path: null,
    notice_of_intent_storage_path: null,
    lien_document_storage_path: null,
    first_downloaded_at: null,
    download_count: 0,
    created_at: '2026-04-24T00:00:00Z',
    updated_at: '2026-04-24T00:00:00Z',
    ...overrides,
  }
}

const CO_TEMPLATES = [renderCODemandLetter, renderCONoticeOfIntent, renderCOMechanicsLien]
const TX_TEMPLATES_OC = [renderTXDemandLetter, renderTXPreLienNotice, renderTXLienAffidavit]

describe('templates — statutory references', () => {
  it('CO demand letter references C.R.S. § 38-22-101', () => {
    const doc = renderCODemandLetter(makeCase())
    expect(doc.body).toMatch(/C\.R\.S\. § 38-22-101/)
  })

  it('TX pre-lien notice (subcontractor) references Tex. Prop. Code § 53.056', () => {
    const c = makeCase({ state_code: 'TX', property_type: 'commercial', contractor_role: 'subcontractor' })
    const doc = renderTXPreLienNotice(c)
    expect(doc.title).toMatch(/§ 53\.056/)
    expect(doc.body).toMatch(/§ 53\.056/)
  })

  it('TX pre-lien notice (original contractor) renders the exemption variant', () => {
    const c = makeCase({ state_code: 'TX', property_type: 'commercial', contractor_role: 'original_contractor' })
    const doc = renderTXPreLienNotice(c)
    expect(doc.body).toMatch(/original contractor exempt from § 53\.056/i)
  })

  it('TX lien affidavit references § 53.054', () => {
    const c = makeCase({ state_code: 'TX', property_type: 'commercial' })
    const doc = renderTXLienAffidavit(c)
    expect(doc.title).toMatch(/§ 53\.054/)
    expect(doc.body).toMatch(/§ 53\.054/)
  })
})

describe('templates — chrome + disclaimers', () => {
  it('every template carries the UPL disclaimer in the footer', () => {
    const cases = [
      ...CO_TEMPLATES.map(fn => fn(makeCase())),
      ...TX_TEMPLATES_OC.map(fn => fn(makeCase({ state_code: 'TX', property_type: 'commercial' }))),
    ]
    for (const doc of cases) {
      expect(doc.disclaimerFooter).toMatch(/Earth Pro Connect LLC is not a law firm/i)
      expect(doc.disclaimerFooter).toContain('C.R.S. § 38-22-128')
      expect(doc.disclaimerFooter).toContain('Tex. Prop. Code § 53.156')
    }
  })

  it('every template header contains "GENERATED DOCUMENT — NOT LEGAL ADVICE"', () => {
    const cases = [
      ...CO_TEMPLATES.map(fn => fn(makeCase())),
      ...TX_TEMPLATES_OC.map(fn => fn(makeCase({ state_code: 'TX', property_type: 'commercial' }))),
    ]
    for (const doc of cases) {
      expect(doc.disclaimerHeader).toMatch(/GENERATED DOCUMENT — NOT LEGAL ADVICE/)
    }
  })

  it('CO + TX templates contain at least one [VERIFY WITH {STATE} ATTORNEY: ...] placeholder', () => {
    for (const fn of CO_TEMPLATES) {
      const doc = fn(makeCase())
      expect(doc.body).toMatch(/\[VERIFY WITH COLORADO ATTORNEY:/)
    }
    for (const fn of TX_TEMPLATES_OC) {
      const doc = fn(makeCase({ state_code: 'TX', property_type: 'commercial' }))
      expect(doc.body).toMatch(/\[VERIFY WITH TEXAS ATTORNEY:/)
    }
  })

  it('no template body contains case citations (e.g. "Medlock v. LegalZoom")', () => {
    // Match "<Capitalized> v. <Capitalized> (YYYY)" or typical reporter citations.
    const CASE_CITE_RE = /[A-Z][A-Za-z']+ v\. [A-Z][A-Za-z]+[^)]*\(\d{4}\)/
    const cases = [
      ...CO_TEMPLATES.map(fn => fn(makeCase())),
      ...TX_TEMPLATES_OC.map(fn => fn(makeCase({ state_code: 'TX', property_type: 'commercial' }))),
    ]
    for (const doc of cases) {
      expect(doc.body).not.toMatch(CASE_CITE_RE)
    }
  })
})

describe('templates — no LLM imports anywhere in src/lib/collections/', () => {
  function walkFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry)
      const s = statSync(p)
      if (s.isDirectory()) walkFiles(p, out)
      else if (/\.(ts|tsx)$/.test(entry)) out.push(p)
    }
    return out
  }

  it('no file imports anthropic or calls api.anthropic.com', () => {
    const base = path.resolve(process.cwd(), 'src/lib/collections')
    const files = walkFiles(base)
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} must not import anthropic`).not.toMatch(/@anthropic-ai\/sdk|from ['"]anthropic['"]/)
      expect(src, `${f} must not call api.anthropic.com`).not.toMatch(/api\.anthropic\.com/)
      expect(src, `${f} must not import openai`).not.toMatch(/from ['"]openai['"]/)
    }
  })
})
