// RTB-precedence wrapper for tx_sos_biz results.
//
// Problem: tx_sos_biz parser emits business_inactive when SOS status letter is
// anything other than 'A' (Active). But in TX Comptroller schema, RTB (Right To
// transact Business) is the authoritative active/inactive signal — RTB=A means
// the entity has right to transact business regardless of SOS letter (which can
// be R=Restored, T=Tax-current, etc. — none of which mean inactive).
//
// Austin Industries appeared as: SOS=R RTB=A → parser said business_inactive →
// contributed to the score's hard cap to 35. RTB=A means active. Fix:
// post-process to flip business_inactive → business_active when RTB=A is
// present in the summary.

import type { ScraperEvidence } from '../types';

const RTB_PATTERN = /RTB=([A-Z])/;
const SOS_PATTERN = /SOS=([A-Z])/;

export function enforceTxSosBizRtbPrecedence(result: ScraperEvidence): ScraperEvidence {
  if (result.finding_type !== 'business_inactive' && result.finding_type !== 'business_dissolved') {
    return result;
  }

  const summary = result.finding_summary ?? '';
  const rtbMatch = RTB_PATTERN.exec(summary);
  const sosMatch = SOS_PATTERN.exec(summary);

  // Only act if both fields are present (this is the new-format raw-letter case)
  if (!rtbMatch || !sosMatch) return result;

  const rtb = rtbMatch[1];
  const sos = sosMatch[1];

  // RTB=A → entity has Right To Business → it's active, regardless of SOS letter
  if (rtb === 'A') {
    return {
      ...result,
      finding_type: 'business_active',
      finding_summary: `TX Comptroller: entity is active per Right-To-Business (RTB=A); SOS standing letter '${sos}' does not indicate inactive status. (Wrapper RTB-precedence correction.)`,
      extracted_facts: {
        ...result.extracted_facts,
        rtb_precedence_wrapper: {
          rtb,
          sos,
          original_finding_type: result.finding_type,
          original_summary: summary,
        },
      },
    };
  }

  // RTB=F (Forfeited) or other non-A values legitimately mean not active
  return result;
}
