// County assessor / appraisal-district portal URLs. Used by the property-helper
// API and the intake wizard "Not sure who owns this?" flow.
//
// v0 coverage:
//   Colorado — 15 most populous counties
//   Texas — 10 DFW-metro counties (scope matches the CO+TX commercial v0 launch)

export const COLORADO_COUNTIES = [
  'denver','adams','arapahoe','boulder','broomfield','douglas','el_paso',
  'jefferson','larimer','mesa','pueblo','weld','garfield','eagle','summit',
] as const

export const TEXAS_DFW_COUNTIES = [
  'dallas','tarrant','denton','collin','rockwall','kaufman','ellis','johnson','parker','wise',
] as const

type CoCounty = typeof COLORADO_COUNTIES[number]
type TxCounty = typeof TEXAS_DFW_COUNTIES[number]

const CO_ASSESSOR_URLS: Record<CoCounty, string> = {
  denver:     'https://www.denvergov.org/property/realproperty',
  adams:      'https://adamscountyassessor.org/',
  arapahoe:   'https://www.arapahoeco.gov/1128/Assessor',
  boulder:    'https://assessor.boco.solutions/',
  broomfield: 'https://www.broomfield.org/136/Assessor',
  douglas:    'https://www.douglas.co.us/assessor/',
  el_paso:    'https://assessor.elpasoco.com/',
  jefferson:  'https://www.jeffco.us/498/Assessor',
  larimer:    'https://www.larimer.gov/assessor',
  mesa:       'https://assessor.mesacounty.us/',
  pueblo:     'https://www.pueblocounty.us/assessor',
  weld:       'https://www.weld.gov/Government/Departments/Assessor',
  garfield:   'https://www.garfield-county.com/assessor/',
  eagle:      'https://www.eaglecounty.us/assessor/',
  summit:     'https://www.summitcountyco.gov/79/Assessor',
}

const TX_ASSESSOR_URLS: Record<TxCounty, string> = {
  dallas:   'https://www.dallascad.org/',
  tarrant:  'https://www.tad.org/',
  denton:   'https://www.dentoncad.com/',
  collin:   'https://www.collincad.org/',
  rockwall: 'https://www.rockwallcad.com/',
  kaufman:  'https://www.kaufman-cad.org/',
  ellis:    'https://www.elliscad.com/',
  johnson:  'https://www.johnsoncad.com/',
  parker:   'https://www.isouthwestdata.com/',
  wise:     'https://www.wise-cad.com/',
}

export function normalizeCounty(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+county$/i, '').replace(/\s+/g, '_')
}

export function getAssessorUrl(state: 'CO' | 'TX', county: string): string | null {
  const key = normalizeCounty(county)
  if (state === 'CO' && (COLORADO_COUNTIES as readonly string[]).includes(key)) {
    return CO_ASSESSOR_URLS[key as CoCounty]
  }
  if (state === 'TX' && (TEXAS_DFW_COUNTIES as readonly string[]).includes(key)) {
    return TX_ASSESSOR_URLS[key as TxCounty]
  }
  return null
}

export function isSupportedCounty(state: 'CO' | 'TX', county: string): boolean {
  const key = normalizeCounty(county)
  if (state === 'CO') return (COLORADO_COUNTIES as readonly string[]).includes(key)
  if (state === 'TX') return (TEXAS_DFW_COUNTIES as readonly string[]).includes(key)
  return false
}
