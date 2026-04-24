import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

// Counsel-audit marker — see tx/demand-letter.ts. [VERIFY WITH TEXAS ATTORNEY: ...]
const V = (desc: string): string => `[VERIFY WITH TEXAS ATTORNEY: ${desc}]`

// Tex. Prop. Code § 53.056 notice — the critical doc for TX subcontractors and
// material suppliers. Original contractors get a note-only variant since
// § 53.052 exempts them from the § 53.056 monthly-notice regime on commercial
// non-residential per the statutory scheme (counsel to confirm).
export function renderTXPreLienNotice(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : V('legal description required — obtain from county appraisal district')

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : V('property owner name and address of record — obtain from county appraisal district')

  const isOriginalContractor = c.contractor_role === 'original_contractor'
  const title = 'NOTICE TO OWNER AND ORIGINAL CONTRACTOR OF UNPAID BALANCE (TEX. PROP. CODE § 53.056)'
  const today = new Date()

  if (isOriginalContractor) {
    const body = [
      title,
      '',
      'NOTE: Original contractors on commercial, non-residential property are not generally subject to the § 53.056 monthly pre-lien notice regime. This document is provided as the record of the unpaid balance and the party against whom collection is being pursued.',
      '',
      V('Confirmation that original contractor exempt from § 53.056 notice on this fact pattern'),
      '',
      'Claimant (original contractor):',
      addressBlock(c.claimant_name, c.claimant_address),
      '',
      'Property owner:',
      ownerBlock,
      '',
      'Property:',
      `${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
      `County: ${c.property_county}`,
      `Legal description: ${legalDesc}`,
      '',
      `Month and year of unpaid labor / materials (last day): ${formatDate(c.last_day_of_work)}`,
      `Amount unpaid: ${formatCurrency(c.amount_owed_cents)}`,
      `Description of work: ${c.work_description}`,
      '',
      `Date of notice: ${formatDate(today)}`,
      'Signature: _______________________________',
      c.claimant_name,
    ].join('\n')
    return {
      title,
      body,
      disclaimerHeader: headerBlock(),
      disclaimerFooter: footerBlock(),
    }
  }

  const body = [
    title,
    '',
    V('Statutory notice language per Tex. Prop. Code § 53.056 for subcontractor notice; exact form must be attorney-approved for contractor_role=subcontractor or below'),
    '',
    'Claimant (subcontractor / material supplier):',
    addressBlock(c.claimant_name, c.claimant_address),
    '',
    'To Property Owner:',
    ownerBlock,
    '',
    'To Original Contractor:',
    addressBlock(c.respondent_name, c.respondent_address),
    '',
    'Property:',
    `${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Legal description: ${legalDesc}`,
    '',
    `Month and year of unpaid labor / materials (last day): ${formatDate(c.last_day_of_work)}`,
    `Amount unpaid: ${formatCurrency(c.amount_owed_cents)}`,
    `Description of work: ${c.work_description}`,
    '',
    'You are hereby notified that the undersigned claims an unpaid balance in the amount stated above for labor performed and/or materials furnished to the original contractor for the improvement of the above-described property.',
    '',
    V('Fund-trapping notice specific statutory language per Tex. Prop. Code § 53.081-.084 if claimant intends to invoke fund-trapping'),
    '',
    `Date of notice: ${formatDate(today)}`,
    'Signature: _______________________________',
    c.claimant_name,
  ].join('\n')

  return {
    title,
    body,
    disclaimerHeader: headerBlock(),
    disclaimerFooter: footerBlock(),
  }
}
