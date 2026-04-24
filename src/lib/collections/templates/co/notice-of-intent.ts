// This template emits CUSTOMER VERIFICATION REQUIRED amber callouts via customerVerification() calls below.
import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, customerVerification, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

export function renderCONoticeOfIntent(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : customerVerification({
        state: 'CO',
        statuteSection: 'C.R.S. § 38-22-109(1)',
        description: "The legal description of the property (lot/block/subdivision or metes-and-bounds — NOT the street address) is missing from your intake. Look it up using Appendix B — Legal Description Lookup. Call your county recorder if you cannot find it online.",
        packetSection: 'Appendix B — Legal Description Lookup',
      })

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : customerVerification({
        state: 'CO',
        statuteSection: 'C.R.S. § 38-22-109(3)',
        description: "Property owner name and mailing address of record. Colorado requires the NOI to be served on the owner. If you do not know the owner, the county assessor website in Appendix A lists it publicly for every parcel.",
        packetSection: 'Appendix A — County Filing Directory',
      })

  const today = new Date()
  const body = [
    'NOTICE OF INTENT TO FILE MECHANIC’S LIEN',
    '',
    'Claimant:',
    addressBlock(c.claimant_name, c.claimant_address),
    '',
    'To the property owner and the party against whom this claim is made:',
    ownerBlock,
    '',
    addressBlock(c.respondent_name, c.respondent_address),
    '',
    'Property subject to this claim:',
    `${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Legal description: ${legalDesc}`,
    '',
    customerVerification({
      state: 'CO',
      statuteSection: 'C.R.S. § 38-22-109(3)',
      description: "Colorado requires a 10-day notice of intent to file a lien. The paragraph below summarizes the statute in plain English, but the statute itself controls. Read the current § 38-22-109(3) at leg.colorado.gov and confirm the form of this notice matches what the statute currently requires before you serve it.",
      packetSection: 'Step 2 — Notice of Intent to Lien',
    }),
    '',
    `Claimant provides notice that unless payment of ${formatCurrency(c.amount_owed_cents)} is received within ten (10) days of the date of this notice, claimant intends to file a statement of mechanic's lien against the above-described property per C.R.S. § 38-22-109(1).`,
    '',
    `Description of labor and materials furnished: ${c.work_description}`,
    `First day of labor: ${formatDate(c.first_day_of_work)}`,
    `Last day of labor: ${formatDate(c.last_day_of_work)}`,
    '',
    customerVerification({
      state: 'CO',
      statuteSection: 'C.R.S. § 38-22-109(3)',
      description: "Method of service. Certified mail with return receipt requested is the standard method Colorado contractors use. Read Step 2 — 'Serving the NOI' in your packet for the options, costs, and how to preserve your proof of service.",
      packetSection: 'Step 2 — Notice of Intent to Lien',
    }),
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
