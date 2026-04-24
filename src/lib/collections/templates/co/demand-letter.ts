import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

// Counsel-audit marker: each [VERIFY WITH COLORADO ATTORNEY: ...] call site
// must be reviewed and either approved or replaced with attorney-authored text
// before this template ships to live traffic.
const V = (desc: string): string => `[VERIFY WITH COLORADO ATTORNEY: ${desc}]`

export function renderCODemandLetter(c: CollectionsCase): RenderedDocument {
  const today = new Date()
  const body = [
    addressBlock(c.claimant_name, c.claimant_address),
    '',
    formatDate(today),
    '',
    addressBlock(c.respondent_name, c.respondent_address),
    '',
    'Subject: DEMAND FOR PAYMENT',
    '',
    `This letter is a formal demand for payment of ${formatCurrency(c.amount_owed_cents)} owed to ${c.claimant_name} for ${c.work_description} performed at ${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip} between ${formatDate(c.first_day_of_work)} and ${formatDate(c.last_day_of_work)}.`,
    '',
    'Despite the services rendered and materials supplied, payment has not been received as of the date of this letter.',
    '',
    'Demand is hereby made for payment of the full amount owed within ten (10) business days of your receipt of this letter.',
    '',
    `Should payment not be received within that time, ${c.claimant_name} intends to pursue all available remedies under Colorado law, which may include the filing of a notice of intent to lien and the filing of a mechanic's lien against the property pursuant to C.R.S. § 38-22-101 et seq.`,
    '',
    V('Preferred closing paragraph — whether to include specific amounts for attorney fees, interest, costs'),
    '',
    'Sincerely,',
    '',
    '',
    c.claimant_name,
    c.claimant_phone ?? '',
    c.claimant_email ?? '',
  ].join('\n')

  return {
    title: 'Demand for Payment',
    body,
    disclaimerHeader: headerBlock(),
    disclaimerFooter: footerBlock(),
  }
}
