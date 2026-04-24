// This template emits CUSTOMER VERIFICATION REQUIRED amber callouts via customerVerification() calls below.
import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, customerVerification, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

export function renderCOMechanicsLien(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : customerVerification({
        state: 'CO',
        statuteSection: 'C.R.S. § 38-22-109(1)',
        description: "The legal description is a required element of a Colorado lien statement. Look it up using Appendix B before filing. A lien without a legal description is vulnerable to attack.",
        packetSection: 'Appendix B — Legal Description Lookup',
      })

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : customerVerification({
        state: 'CO',
        statuteSection: 'C.R.S. § 38-22-109(1)',
        description: "Property owner name and address of record. The lien is filed against the owner of record as of the date of filing. Confirm the current record owner via your county assessor before filing.",
        packetSection: 'Appendix A — County Filing Directory',
      })

  const body = [
    'STATEMENT OF MECHANIC’S LIEN',
    '',
    customerVerification({
      state: 'CO',
      statuteSection: 'C.R.S. § 38-22-109(1)',
      description: "The statement of lien has specific required elements under Colorado law. Read Step 3 of your instruction packet and the current text of § 38-22-109(1) on leg.colorado.gov. Confirm every required element below is filled in and the opening language matches the statute before you notarize and file.",
      packetSection: 'Step 3 — Statement of Mechanic’s Lien',
    }),
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
    customerVerification({
      state: 'CO',
      statuteSection: 'C.R.S. § 38-22-109(1)',
      description: "Colorado lien statements must be verified (sworn to before a notary public). Read Step 3 — 'Notarization' in your packet. The notary block below is a jurat; the notary will guide you through signing and will apply their seal.",
      packetSection: 'Step 3 — Statement of Mechanic’s Lien / Notary Guide',
    }),
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
