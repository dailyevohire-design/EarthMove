import { z } from 'zod'
import type { ContractorRole, PropertyType } from './types'

export const IntakeSchema = z.object({
  state_code:      z.enum(['CO','TX']),
  contractor_role: z.enum(['original_contractor','subcontractor','sub_subcontractor','material_supplier','other']),
  property_type:   z.enum(['commercial','residential_non_homestead','residential_homestead','mixed_use','industrial','other']),
  is_homestead:    z.boolean(),

  claimant_name:         z.string().min(1).max(300),
  claimant_address:      z.string().min(5).max(500),
  claimant_phone:        z.string().max(50).nullable().optional(),
  claimant_email:        z.string().email().max(200).nullable().optional(),
  claimant_entity_type:  z.enum(['individual','llc','corporation','partnership','sole_proprietor','other']).nullable().optional(),

  respondent_name:          z.string().min(1).max(300),
  respondent_address:       z.string().min(5).max(500),
  respondent_relationship:  z.enum(['general_contractor','subcontractor','property_owner','developer','other']).nullable().optional(),

  property_street_address:  z.string().min(5).max(500),
  property_city:            z.string().min(1).max(200),
  property_state:           z.enum(['CO','TX']),
  property_zip:             z.string().regex(/^\d{5}(-\d{4})?$/),
  property_county:          z.string().min(1).max(100),
  property_legal_description: z.string().max(2000).nullable().optional(),

  property_owner_name:    z.string().max(300).nullable().optional(),
  property_owner_address: z.string().max(500).nullable().optional(),
  owner_lookup_method:    z.enum(['manual','county_assessor_link','automated_phase2']).nullable().optional(),
  owner_lookup_source_url:z.string().url().max(500).nullable().optional(),

  original_contract_signed_date:          z.string().nullable().optional(),
  original_contract_both_spouses_signed:  z.boolean().nullable().optional(),

  work_description:  z.string().min(50).max(5000),
  first_day_of_work: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_day_of_work:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_owed_cents: z.number().int().positive(),

  pre_lien_notices_sent: z.array(z.string()).optional().default([]),
})

export type IntakeInput = z.infer<typeof IntakeSchema>

export type ValidationError = { error: string; message?: string; warnings?: string[] }
export type ValidationResult =
  | { ok: true; warnings: string[] }
  | { ok: false; status: 400; error: string; message: string }

// TX § 53.056 commercial: notice due by the 15th of the 3rd month after the unpaid month.
function tx56CommercialDeadline(lastDayOfWork: Date, now: Date): { deadlinePast: boolean; deadline: Date } {
  const year  = lastDayOfWork.getUTCFullYear()
  const month = lastDayOfWork.getUTCMonth()
  // 3rd month after = month + 3
  const deadline = new Date(Date.UTC(year, month + 3, 15))
  return { deadlinePast: now > deadline, deadline }
}

export function validateIntake(
  parsed: IntakeInput,
  now: Date = new Date(),
): ValidationResult {
  const warnings: string[] = []

  // --- Property state must equal state_code ---
  if (parsed.property_state !== parsed.state_code) {
    return { ok: false, status: 400, error: 'invalid_property_state',
      message: 'Property state must match the case state.' }
  }

  // --- Homestead always blocked ---
  if (parsed.is_homestead) {
    return { ok: false, status: 400, error: 'homestead_not_supported',
      message: 'Homestead properties require additional legal process. Please consult an attorney.' }
  }

  // --- TX v0 scope: commercial/industrial only ---
  if (parsed.state_code === 'TX') {
    if (!(parsed.property_type === 'commercial' || parsed.property_type === 'industrial')) {
      // residential_homestead would also fall here, but is_homestead=true would have
      // short-circuited earlier. Keep the TX-specific message for the residential /
      // mixed_use / other cases.
      if (parsed.property_type === 'residential_homestead') {
        return { ok: false, status: 400, error: 'homestead_not_supported',
          message: 'Homestead properties are not supported.' }
      }
      return { ok: false, status: 400, error: 'tx_v0_requires_commercial',
        message: "Texas Collections Assist v0 supports commercial properties only. Residential Texas lien filings require additional attorney-reviewed workflows and are coming in a future release." }
    }
  }

  // --- CO v0 scope ---
  if (parsed.state_code === 'CO') {
    if (parsed.property_type === 'residential_homestead') {
      return { ok: false, status: 400, error: 'homestead_not_supported',
        message: 'Homestead properties require additional legal process. Please consult an attorney.' }
    }
    if (parsed.property_type === 'other') {
      return { ok: false, status: 400, error: 'property_type_not_supported',
        message: 'This property type is not currently supported.' }
    }
  }

  // --- Amount + dates sanity ---
  if (parsed.amount_owed_cents <= 0) {
    return { ok: false, status: 400, error: 'invalid_amount',
      message: 'Amount owed must be greater than zero.' }
  }
  const first = new Date(parsed.first_day_of_work + 'T00:00:00Z')
  const last  = new Date(parsed.last_day_of_work  + 'T00:00:00Z')
  if (isNaN(first.getTime()) || isNaN(last.getTime())) {
    return { ok: false, status: 400, error: 'invalid_dates',
      message: 'Work dates could not be parsed.' }
  }
  if (first > last) {
    return { ok: false, status: 400, error: 'invalid_date_order',
      message: 'First day of work must be on or before the last day of work.' }
  }

  // --- 4-month deadline ---
  // CO: any claim requires last_day_of_work within the last 4 months (C.R.S. § 38-22-109(5))
  // TX commercial original contractor: similar 4-month outer window per § 53.052(a)
  // TX subs/suppliers: different regime (§ 53.056) — we emit warnings but do not hard-block here.
  const fourMonthsAgo = new Date(now)
  fourMonthsAgo.setUTCMonth(fourMonthsAgo.getUTCMonth() - 4)
  const deadlineRole: ContractorRole = parsed.contractor_role

  if (parsed.state_code === 'CO' && last < fourMonthsAgo) {
    return { ok: false, status: 400, error: 'past_filing_deadline',
      message: "Colorado mechanic's liens must be filed within 4 months of the last day of work per C.R.S. § 38-22-109(5)." }
  }
  if (
    parsed.state_code === 'TX' &&
    deadlineRole === 'original_contractor' &&
    last < fourMonthsAgo
  ) {
    return { ok: false, status: 400, error: 'past_filing_deadline',
      message: 'Texas original-contractor lien filing deadlines require work within the last 4 months for commercial property. Consult an attorney immediately.' }
  }

  // --- TX sub § 53.056 timing warning (non-blocking) ---
  if (parsed.state_code === 'TX' &&
      (deadlineRole === 'subcontractor' || deadlineRole === 'sub_subcontractor' || deadlineRole === 'material_supplier')) {
    const { deadlinePast, deadline } = tx56CommercialDeadline(last, now)
    if (deadlinePast) {
      warnings.push(
        `Texas § 53.056 pre-lien notice deadline for commercial property was ${deadline.toISOString().slice(0, 10)} (15th day of the 3rd month after the unpaid month). Late notices may impair lien rights. Consult an attorney.`,
      )
    } else {
      warnings.push(
        `Texas subcontractors and suppliers must send pre-lien notices per Tex. Prop. Code § 53.056 by the 15th of the 3rd month after each unpaid month. Your next deadline for this claim is ${deadline.toISOString().slice(0, 10)}.`,
      )
    }
  }

  return { ok: true, warnings }
}

// Dead-code branch per spec: TX original contractor on homestead requires pre-work contract
// with both spouses' signatures. The homestead+TX combo is blocked above so this helper is
// never reached in v0. TODO(v1): reinstate when residential TX + homestead ships.
export function _unused_txHomesteadOriginalContractorGuard(_role: ContractorRole, _propertyType: PropertyType): void {
  /* intentionally empty */
}
