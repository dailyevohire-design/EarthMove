import { z } from 'zod'
import type { CollectionsKitVariant, ContractorRole } from './types'

export const IntakeSchema = z.object({
  state_code:      z.enum(['CO','TX']),
  contractor_role: z.enum([
    'original_contractor','subcontractor','sub_subcontractor','material_supplier','other',
    'hired_by_broker','hired_by_staffing','not_construction_work',
  ]),
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

export type ValidationResult =
  | { ok: true; warnings: string[]; kit_variant: CollectionsKitVariant }
  | { ok: false; status: 400; error: string; message: string }

function tx56CommercialDeadline(lastDayOfWork: Date, now: Date): { deadlinePast: boolean; deadline: Date } {
  const year  = lastDayOfWork.getUTCFullYear()
  const month = lastDayOfWork.getUTCMonth()
  const deadline = new Date(Date.UTC(year, month + 3, 15))
  return { deadlinePast: now > deadline, deadline }
}

// Kit routing rule: TX + homestead + no pre-work spouse-signed contract → demand-only.
// not_construction_work → demand-only (demand letter has no real-property nexus
// requirement, so it ships for any unpaid invoice).
// Everything else → full_kit. No state+property_type combinations are rejected at v1 —
// the customer sees a demand-only variant if their facts preclude a lien.
export function resolveKitVariant(input: IntakeInput): CollectionsKitVariant {
  if (input.contractor_role === 'not_construction_work') {
    return 'demand_only'
  }
  if (
    input.state_code === 'TX' &&
    input.is_homestead === true &&
    !(input.original_contract_signed_date && input.original_contract_both_spouses_signed === true)
  ) {
    return 'demand_only'
  }
  return 'full_kit'
}

export function validateIntake(
  parsed: IntakeInput,
  now: Date = new Date(),
): ValidationResult {
  const warnings: string[] = []

  if (parsed.property_state !== parsed.state_code) {
    return { ok: false, status: 400, error: 'invalid_property_state',
      message: 'Property state must match the case state.' }
  }

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

  // 4-month deadline — CO hard block; TX original contractor hard block on commercial non-residential.
  const fourMonthsAgo = new Date(now)
  fourMonthsAgo.setUTCMonth(fourMonthsAgo.getUTCMonth() - 4)
  const role: ContractorRole = parsed.contractor_role

  const kit_variant = resolveKitVariant(parsed)

  if (parsed.state_code === 'CO' && last < fourMonthsAgo && kit_variant === 'full_kit') {
    return { ok: false, status: 400, error: 'past_filing_deadline',
      message: "Colorado mechanic's liens must be filed within 4 months of the last day of work per C.R.S. § 38-22-109(5)." }
  }
  if (
    parsed.state_code === 'TX' &&
    role === 'original_contractor' &&
    !parsed.is_homestead &&
    last < fourMonthsAgo &&
    kit_variant === 'full_kit'
  ) {
    return { ok: false, status: 400, error: 'past_filing_deadline',
      message: 'Texas original-contractor lien filing deadlines generally require work within the last 4 months for non-homestead commercial property. Consult an attorney.' }
  }

  // TX sub § 53.056 timing warning (non-blocking).
  if (parsed.state_code === 'TX' &&
      (role === 'subcontractor' || role === 'sub_subcontractor' || role === 'material_supplier')) {
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

  if (kit_variant === 'demand_only') {
    warnings.unshift(
      'Your intake indicates a Texas homestead without a pre-work contract signed by both spouses. Texas Constitution art. XVI § 50 and Tex. Prop. Code § 53.254 do not allow a lien on this fact pattern. Your kit is the demand-only variant — instruction packet + demand letter, no lien affidavit.',
    )
  }

  return { ok: true, warnings, kit_variant }
}
