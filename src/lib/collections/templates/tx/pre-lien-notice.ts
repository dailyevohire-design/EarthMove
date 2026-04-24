// This template emits CUSTOMER VERIFICATION REQUIRED amber callouts via customerVerification() calls below.
import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, customerVerification, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

export function renderTXPreLienNotice(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : customerVerification({
        state: 'TX',
        statuteSection: 'Tex. Prop. Code § 53.054',
        description: "Texas lien affidavits require a description of the property. A street address plus a clear description usually suffices, but a legal description from the county deed is stronger. Look it up using Appendix B.",
        packetSection: 'Appendix B — Legal Description Lookup',
      })

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : customerVerification({
        state: 'TX',
        statuteSection: 'Tex. Prop. Code § 53.056',
        description: "Texas pre-lien notices must be sent to the property owner at the last known address. Find the current owner of record through your county appraisal district (see Appendix A).",
        packetSection: 'Appendix A — County Filing Directory',
      })

  const isOriginalContractor = c.contractor_role === 'original_contractor'
  const title = 'NOTICE TO OWNER AND ORIGINAL CONTRACTOR OF UNPAID BALANCE (TEX. PROP. CODE § 53.056)'
  const today = new Date()

  if (isOriginalContractor) {
    const body = [
      title,
      '',
      'NOTE: Original contractors on non-homestead, commercial property are not generally subject to the § 53.056 monthly pre-lien notice regime. This document is provided as the record of the unpaid balance and the party against whom collection is being pursued.',
      '',
      customerVerification({
        state: 'TX',
        statuteSection: 'Tex. Prop. Code § 53.052',
        description: "Whether you need to send pre-lien notices depends on your contractor tier. Original contractors generally do not send § 53.056 notices on commercial property. Read Step 1 and the 'Your Contractor Tier' section of your packet and confirm § 53.052 applies to your fact pattern before skipping the pre-lien notice step.",
        packetSection: 'Your Contractor Tier / Step 1 — Pre-Lien Notices',
      }),
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
    customerVerification({
      state: 'TX',
      statuteSection: 'Tex. Prop. Code § 53.056',
      description: "Texas requires subcontractors, sub-subcontractors, and material suppliers to send pre-lien notices on specific calendar deadlines. The commercial deadline is the 15th day of the 3rd month after each unpaid month; the residential deadline is the 15th day of the 2nd month. Read Step 1 of your instruction packet and confirm the timing for your fact pattern against § 53.056 at statutes.capitol.texas.gov before serving.",
      packetSection: 'Step 1 — Pre-Lien Notices',
    }),
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
    customerVerification({
      state: 'TX',
      statuteSection: 'Tex. Prop. Code §§ 53.081–.084',
      description: "If you want to invoke fund-trapping (requiring the owner to withhold payments from the general contractor), Texas requires specific statutory language in this notice. Read the 'Fund-Trapping' subsection of Step 1 and decide whether to add the fund-trapping statement before sending.",
      packetSection: 'Step 1 — Pre-Lien Notices / Fund-Trapping',
    }),
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
