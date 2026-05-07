/**
 * Generates three sample PDFs to /tmp using the new renderer:
 *   - FTEST_judge_dfw    (CRITICAL, no stamp — score 35)
 *   - FTEST_pass_clean   (LOW with stamp — score 91, paid tier with QR)
 *   - FTEST_medium_mixed (MEDIUM band — score 67, paid tier with one UNVERIFIED chip)
 *
 * Run via:
 *   pnpm exec tsx scripts/generate-pdf-fixtures.ts
 *
 * Useful for visual QA without needing a live trust_jobs row.
 */

import fs from 'node:fs'
import path from 'node:path'
import { renderTrustPdf } from '../src/lib/trust/pdf/render'

interface Fixture {
  filename: string
  errored?: Set<string>
  report: Parameters<typeof renderTrustPdf>[0]['report']
  evidenceCount: number | null
}

const FIXTURES: Fixture[] = [
  {
    filename: 'FTEST_judge_dfw.pdf',
    evidenceCount: 12,
    report: {
      id: '00000000-0000-0000-0000-00000000aaaa',
      contractor_name: 'Judge DFW LLC',
      city: 'Dallas',
      state_code: 'TX',
      trust_score: 35,
      risk_level: 'CRITICAL',
      summary:
        'Subject is not registered with the Texas Secretary of State and shows no active TDLR license. ' +
        'CourtListener reports a federal civil suit naming the entity as a defendant. ' +
        'No OSHA inspection records on file. Use extreme caution before transacting.',
      red_flags: [
        'Not registered with Texas Secretary of State',
        'Federal civil litigation as defendant (CourtListener docket)',
        'No active license verified in TDLR or DBPR',
        'Subject of consumer-protection complaint at TX AG (2024)',
      ],
      positive_indicators: [],
      data_sources_searched: [
        'tx_sos_biz', 'tx_tdlr', 'sam_gov_exclusions', 'courtlistener_fed', 'state_ag_enforcement',
      ],
      created_at: '2026-05-07T15:00:00.000Z',
      job_id: '11111111-1111-1111-1111-1111111111aa',
      biz_entity_type: null,
      biz_formation_date: null,
      lic_license_number: null,
      biz_status: 'not_found',
      lic_status: 'not_found',
      osha_status: null,
      bbb_rating: null,
    },
  },
  {
    filename: 'FTEST_pass_clean.pdf',
    evidenceCount: 14,
    report: {
      id: '00000000-0000-0000-0000-00000000bbbb',
      contractor_name: 'Brannan Sand & Gravel Co.',
      city: 'Denver',
      state_code: 'CO',
      trust_score: 91,
      risk_level: 'LOW',
      summary:
        'Long-tenured Colorado entity with active SOS registration since 1948 and an active DORA license. ' +
        'No OSHA citations or recent legal actions surfaced. BBB profile is A+ and unaccredited but ' +
        'consumer complaint count is zero. Strong public-records standing.',
      red_flags: [],
      positive_indicators: [
        'Active CO SOS registration (continuous since 1948)',
        'Active DORA license, no disciplinary record',
        'No OSHA violations on file across IMIS',
        'BBB A+ rating with zero unresolved complaints',
        'Federal CourtListener: clean (no recent actions)',
      ],
      data_sources_searched: [
        'co_sos_biz', 'co_dora', 'sam_gov_exclusions', 'courtlistener_fed', 'state_ag_enforcement',
        'bbb_profile', 'osha_est_search', 'denver_pim',
      ],
      created_at: '2026-05-07T15:00:00.000Z',
      job_id: '22222222-2222-2222-2222-222222222bbb',
      biz_entity_type: 'Colorado Corporation',
      biz_formation_date: '1948-03-12',
      lic_license_number: 'CO-DORA-04421',
      biz_status: 'active',
      lic_status: 'active',
      osha_status: 'clean',
      bbb_rating: 'A+',
    },
  },
  {
    filename: 'FTEST_medium_mixed.pdf',
    evidenceCount: 9,
    errored: new Set<string>(['bbb_profile']),
    report: {
      id: '00000000-0000-0000-0000-00000000cccc',
      contractor_name: 'Plains Building Systems, LLC',
      city: 'Fort Morgan',
      state_code: 'CO',
      trust_score: 67,
      risk_level: 'MEDIUM',
      summary:
        'Active CO SOS registration since 2017 with a current DORA license. One OSHA violation on file ' +
        '(serious, abated 2023) and a 2022 Morgan County felony-theft charge associated with an officer. ' +
        'BBB lookup timed out at scrape time — reputation chip surfaces UNVERIFIED rather than MISSING.',
      red_flags: [
        'OSHA serious violation (abated 2023)',
        'Morgan County felony-theft charge against officer (2022)',
      ],
      positive_indicators: [
        'Active CO SOS registration since 2017',
        'Current DORA license, no recent disciplinary record',
      ],
      data_sources_searched: [
        'co_sos_biz', 'co_dora', 'sam_gov_exclusions', 'courtlistener_fed', 'state_ag_enforcement',
        'bbb_profile', 'osha_est_search',
      ],
      created_at: '2026-05-07T15:00:00.000Z',
      job_id: '33333333-3333-3333-3333-333333333ccc',
      biz_entity_type: 'Limited Liability Company',
      biz_formation_date: '2017-09-04',
      lic_license_number: 'CO-DORA-19223',
      biz_status: 'active',
      lic_status: 'active',
      osha_status: 'serious',
      bbb_rating: null,
    },
  },
]

async function main() {
  const outDir = '/tmp'
  for (const fx of FIXTURES) {
    const outPath = path.join(outDir, fx.filename)
    process.stdout.write(`  rendering ${fx.filename} ... `)
    const start = Date.now()
    const buf = await renderTrustPdf({
      report: fx.report,
      evidenceCount: fx.evidenceCount,
      errored_source_keys: fx.errored,
      origin: 'https://earthmove.io',
    })
    fs.writeFileSync(outPath, buf)
    const stat = fs.statSync(outPath)
    process.stdout.write(`OK (${stat.size} bytes, ${Date.now() - start}ms) → ${outPath}\n`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
