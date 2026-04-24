// This template emits CUSTOMER VERIFICATION REQUIRED amber callouts via customerVerification() calls below.
import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, customerVerification, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

export function renderTXLienAffidavit(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : customerVerification({
        state: 'TX',
        statuteSection: 'Tex. Prop. Code § 53.054',
        description: "A Texas lien affidavit must describe the property. A street address is the minimum; a full legal description from the county deed is stronger. Look it up using Appendix B.",
        packetSection: 'Appendix B — Legal Description Lookup',
      })

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : customerVerification({
        state: 'TX',
        statuteSection: 'Tex. Prop. Code § 53.054',
        description: "The property owner of record must be correctly named in the lien affidavit. Confirm through your county appraisal district (see Appendix A).",
        packetSection: 'Appendix A — County Filing Directory',
      })

  const originalContractorLine = c.contractor_role === 'original_contractor'
    ? `${c.claimant_name} (claimant is the original contractor)`
    : addressBlock(c.respondent_name, c.respondent_address)

  const notices = c.pre_lien_notices_sent ?? []
  const isSubOrSupplier = c.contractor_role !== 'original_contractor' && c.contractor_role !== 'other'
  const noticeClause = isSubOrSupplier
    ? (notices.length > 0
        ? `Pre-lien notices under Tex. Prop. Code § 53.056 were sent on: ${notices.map(formatDate).join(', ')}.`
        : customerVerification({
            state: 'TX',
            statuteSection: 'Tex. Prop. Code § 53.056',
            description: "You are a subcontractor or supplier and your intake does not list any pre-lien notice dates sent. For non-original-contractor tiers, § 53.056 notice compliance is generally a prerequisite to a valid affidavit. Read Step 1 of the packet and confirm your notice history before filing.",
            packetSection: 'Step 1 — Pre-Lien Notices',
          }))
    : ''

  const body = [
    'AFFIDAVIT OF LIEN (Tex. Prop. Code § 53.054)',
    '',
    customerVerification({
      state: 'TX',
      statuteSection: 'Tex. Prop. Code § 53.054',
      description: "Texas lien affidavits have specific required elements under § 53.054(a). Read Step 3 of your instruction packet and the current text of § 53.054 at statutes.capitol.texas.gov. Confirm every required element below is present and that the opening affidavit language matches the statute before you notarize and file.",
      packetSection: 'Step 3 — Lien Affidavit',
    }),
    '',
    'BEFORE ME, the undersigned authority, personally appeared the claimant named below, who being duly sworn, deposed and stated as follows:',
    '',
    `1. Claimant: ${c.claimant_name}, ${c.claimant_address}`,
    `2. Property owner: ${ownerBlock}`,
    `3. Original contractor: ${originalContractorLine}`,
    `4. Property: ${c.property_street_address}, ${c.property_city}, ${c.property_state} ${c.property_zip}`,
    `   County: ${c.property_county}`,
    `   Legal description: ${legalDesc}`,
    `5. Description of work / materials furnished: ${c.work_description}`,
    `6. Amount claimed after all just credits and offsets: ${formatCurrency(c.amount_owed_cents)}`,
    `7. Month(s) of unpaid work (last day): ${formatDate(c.last_day_of_work)}`,
    noticeClause ? `8. ${noticeClause}` : '',
    '',
    customerVerification({
      state: 'TX',
      statuteSection: 'Tex. Prop. Code § 53.055',
      description: "Texas requires the lien claimant to send a copy of the filed affidavit to the property owner (and original contractor for lower tiers) within specified days of filing. Read Step 4 of the packet so you do not miss this post-filing deadline.",
      packetSection: 'Step 4 — After Filing',
    }),
    '',
    'Claimant signature: _______________________________',
    c.claimant_name,
    '',
    'STATE OF TEXAS',
    `COUNTY OF ${c.property_county.toUpperCase()}`,
    '',
    'SUBSCRIBED AND SWORN TO before me on this _____ day of __________, 20____.',
    '',
    'Notary Public, State of Texas: _______________________________',
    'My commission expires: _______________________',
  ].filter(line => line !== '' || true).join('\n')

  return {
    title: 'Affidavit of Lien (Tex. Prop. Code § 53.054)',
    body,
    disclaimerHeader: headerBlock(),
    disclaimerFooter: footerBlock(),
  }
}
