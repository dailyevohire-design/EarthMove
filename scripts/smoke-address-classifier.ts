// scripts/smoke-address-classifier.ts
//
// Heuristic-only smoke (no network). Run via:
//   pnpm exec tsx scripts/smoke-address-classifier.ts
//
// Cases are constructed so the assessor branch is never invoked (state='WY',
// for which no assessor client is wired). Validates that classifyAddress +
// classificationToFinding return the expected tuple for the four canonical
// heuristic paths.

import {
  classifyAddress,
  classificationToFinding,
} from '../src/lib/groundcheck/address-classifier'

type Case = {
  name: string
  input: { addr: string; state: string }
  expect: {
    classification: string
    confidence: string
    finding_type: string
    is_red_flag: boolean
  }
}

const cases: Case[] = [
  {
    name: 'PO Box → pobox / verified_structured / red flag',
    input: { addr: 'PO Box 12345, Denver, CO 80202', state: 'WY' },
    expect: {
      classification: 'pobox',
      confidence: 'verified_structured',
      finding_type: 'address_pobox',
      is_red_flag: true,
    },
  },
  {
    name: 'Regus virtual office → virtual_office / high_llm / red flag',
    input: { addr: '1550 Larimer St Regus, Denver, CO 80202', state: 'WY' },
    expect: {
      classification: 'virtual_office',
      confidence: 'high_llm',
      finding_type: 'address_pobox',
      is_red_flag: true,
    },
  },
  {
    name: 'Suite N → commercial / medium_llm / not red flag',
    input: { addr: '100 Main St Suite 200, Dallas, TX 75201', state: 'WY' },
    expect: {
      classification: 'commercial',
      confidence: 'medium_llm',
      finding_type: 'address_commercial',
      is_red_flag: false,
    },
  },
  {
    name: 'Empty string → unknown / unverified',
    input: { addr: '', state: 'WY' },
    expect: {
      classification: 'unknown',
      confidence: 'unverified',
      finding_type: 'address_commercial',
      is_red_flag: false,
    },
  },
]

async function main() {
  let passed = 0
  let failed = 0

  for (const c of cases) {
    const result = await classifyAddress(c.input.addr, c.input.state)
    const finding = classificationToFinding(result, 'high')

    const ok =
      result.classification === c.expect.classification &&
      result.confidence === c.expect.confidence &&
      finding.finding_type === c.expect.finding_type &&
      finding.is_red_flag === c.expect.is_red_flag

    if (ok) {
      passed++
      console.log(`  PASS  ${c.name}`)
    } else {
      failed++
      console.log(`  FAIL  ${c.name}`)
      console.log(`        expected: ${JSON.stringify(c.expect)}`)
      console.log(
        `        got:      classification=${result.classification} confidence=${result.confidence} finding_type=${finding.finding_type} is_red_flag=${finding.is_red_flag}`,
      )
    }
  }

  const verdict = failed === 0 ? 'PASS' : 'FAIL'
  console.log(`\n${verdict}: ${passed}/${passed + failed}`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
