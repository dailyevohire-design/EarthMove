import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

// Counsel-audit marker — see co/demand-letter.ts. [VERIFY WITH COLORADO ATTORNEY: ...]
const V = (desc: string): string => `[VERIFY WITH COLORADO ATTORNEY: ${desc}]`

// Colorado mechanic's lien statement — C.R.S. § 38-22-109(1). Exact statutory
// opening + sworn-verification language are verifyAttorney placeholders.
export function renderCOMechanicsLien(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : V('legal description required — obtain from county recorder')

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : V('property owner name and address of record — obtain from county assessor')

  const body = [
    'STATEMENT OF MECHANIC’S LIEN',
    '',
    V('Formal statement of lien opening language per C.R.S. § 38-22-109(1)'),
    '',
    'Claimant:',
    addressBlock(c.claimant_name, c.claimant_address),
    '',
    'Owner of record:',
    ownerBlock,
    '',
    'Party against whom claim is made (if different from owner):',
    addressBlock(c.respondent_name, c.respondent_address),
    '',
    'Property:',
    `${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Legal description: ${legalDesc}`,
    '',
    `Description of labor and materials furnished: ${c.work_description}`,
    `First day of labor furnished: ${formatDate(c.first_day_of_work)}`,
    `Last day of labor furnished: ${formatDate(c.last_day_of_work)}`,
    '',
    `Amount due after all just credits and offsets: ${formatCurrency(c.amount_owed_cents)}`,
    '',
    V('Sworn verification block — notary acknowledgment format per C.R.S. § 38-22-109(1) and Colorado notary law'),
    '',
    'STATE OF COLORADO',
    `COUNTY OF ${c.property_county.toUpperCase()}`,
    '',
    'Subscribed and sworn before me this _____ day of __________, 20____.',
    '',
    'Notary Public: _______________________________',
    'My commission expires: _______________________',
    '',
    'Claimant signature: _______________________________',
    c.claimant_name,
  ].join('\n')

  return {
    title: 'Statement of Mechanic’s Lien (C.R.S. § 38-22-109)',
    body,
    disclaimerHeader: headerBlock(),
    disclaimerFooter: footerBlock(),
  }
}
