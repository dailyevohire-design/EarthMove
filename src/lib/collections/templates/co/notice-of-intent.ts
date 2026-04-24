import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

// Counsel-audit marker — see co/demand-letter.ts. [VERIFY WITH COLORADO ATTORNEY: ...]
const V = (desc: string): string => `[VERIFY WITH COLORADO ATTORNEY: ${desc}]`

// Colorado statutory 10-day notice — C.R.S. § 38-22-109(3). Exact current-form
// language is a verifyAttorney placeholder; this file never invents statutory text.
export function renderCONoticeOfIntent(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : V('legal description required — obtain from county recorder')

  const today = new Date()
  const body = [
    'NOTICE OF INTENT TO FILE MECHANIC’S LIEN',
    '',
    'Claimant:',
    addressBlock(c.claimant_name, c.claimant_address),
    '',
    'To the property owner and the party against whom this claim is made:',
    c.property_owner_name ? addressBlock(c.property_owner_name, c.property_owner_address ?? '') : V('property owner name and address of record — obtain from county assessor'),
    '',
    addressBlock(c.respondent_name, c.respondent_address),
    '',
    'Property subject to this claim:',
    `${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Legal description: ${legalDesc}`,
    '',
    V('Exact 10-day notice statutory language per C.R.S. § 38-22-109(3) — attorney must confirm current form'),
    '',
    `Claimant provides notice that unless payment of ${formatCurrency(c.amount_owed_cents)} is received within ten (10) days of the date of this notice, claimant intends to file a statement of mechanic’s lien against the above-described property per C.R.S. § 38-22-109(1).`,
    '',
    `Description of labor and materials furnished: ${c.work_description}`,
    `First day of labor: ${formatDate(c.first_day_of_work)}`,
    `Last day of labor: ${formatDate(c.last_day_of_work)}`,
    '',
    V('Service method — certified mail with return receipt requested is standard; attorney to confirm sufficiency for this fact pattern'),
    '',
    'This notice is served by certified mail, return receipt requested.',
    `Date of notice: ${formatDate(today)}`,
    '',
    '',
    'Signature: _______________________________',
    c.claimant_name,
  ].join('\n')

  return {
    title: 'Notice of Intent to File Mechanic’s Lien',
    body,
    disclaimerHeader: headerBlock(),
    disclaimerFooter: footerBlock(),
  }
}
