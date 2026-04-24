import type { CollectionsCase } from '../../types'
import {
  RenderedDocument, addressBlock, formatCurrency, formatDate,
  footerBlock, headerBlock,
} from '../shared'

// Counsel-audit marker — see tx/demand-letter.ts. [VERIFY WITH TEXAS ATTORNEY: ...]
const V = (desc: string): string => `[VERIFY WITH TEXAS ATTORNEY: ${desc}]`

// Texas lien affidavit — Tex. Prop. Code § 53.054.
export function renderTXLienAffidavit(c: CollectionsCase): RenderedDocument {
  const legalDesc = c.property_legal_description && c.property_legal_description.trim().length > 0
    ? c.property_legal_description.trim()
    : V('legal description required — obtain from county appraisal district')

  const ownerBlock = c.property_owner_name
    ? addressBlock(c.property_owner_name, c.property_owner_address ?? '')
    : V('property owner name and address of record — obtain from county appraisal district')

  const originalContractorLine = c.contractor_role === 'original_contractor'
    ? `${c.claimant_name} (claimant is the original contractor)`
    : addressBlock(c.respondent_name, c.respondent_address)

  // Pre-lien notice summary (for non-original-contractors)
  const notices = c.pre_lien_notices_sent ?? []
  const isSubOrSupplier = c.contractor_role !== 'original_contractor' && c.contractor_role !== 'other'
  const noticeClause = isSubOrSupplier
    ? (notices.length > 0
        ? `Pre-lien notices under Tex. Prop. Code § 53.056 were sent on: ${notices.map(formatDate).join(', ')}.`
        : V('Pre-lien notice compliance per § 53.056 — affidavit cannot be filed until notice requirements are satisfied for non-original-contractors'))
    : ''

  const body = [
    'AFFIDAVIT OF LIEN (Tex. Prop. Code § 53.054)',
    '',
    V('Lien affidavit opening and jurat language per Tex. Prop. Code § 53.054(a)'),
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
    V('Affidavit closing and jurat per § 53.054(a)(6) — notary acknowledgment'),
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
