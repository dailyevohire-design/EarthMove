export type CollectionsStatus =
  | 'draft' | 'pending_payment' | 'paid' | 'documents_ready' | 'downloaded' | 'refunded' | 'counsel_review'

export type CollectionsState = 'CO' | 'TX'

export type ContractorRole =
  | 'original_contractor' | 'subcontractor' | 'sub_subcontractor' | 'material_supplier' | 'other'

export type PropertyType =
  | 'commercial' | 'residential_non_homestead' | 'residential_homestead' | 'mixed_use' | 'industrial' | 'other'

export type RespondentRelationship =
  | 'general_contractor' | 'subcontractor' | 'property_owner' | 'developer' | 'other'

export type ClaimantEntityType =
  | 'individual' | 'llc' | 'corporation' | 'partnership' | 'sole_proprietor' | 'other'

export interface CollectionsCase {
  id: string
  user_id: string
  status: CollectionsStatus
  state_code: CollectionsState

  contractor_role: ContractorRole
  property_type: PropertyType
  is_homestead: boolean

  claimant_name: string
  claimant_address: string
  claimant_phone: string | null
  claimant_email: string | null
  claimant_entity_type: ClaimantEntityType | null

  respondent_name: string
  respondent_address: string
  respondent_relationship: RespondentRelationship | null

  property_street_address: string
  property_city: string
  property_state: CollectionsState
  property_zip: string
  property_county: string
  property_legal_description: string | null

  property_owner_name: string | null
  property_owner_address: string | null
  owner_lookup_method: 'manual' | 'county_assessor_link' | 'automated_phase2' | null
  owner_lookup_source_url: string | null

  original_contract_signed_date: string | null
  original_contract_both_spouses_signed: boolean | null

  work_description: string
  first_day_of_work: string
  last_day_of_work: string
  amount_owed_cents: number

  pre_lien_notices_sent: string[]

  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  paid_at: string | null
  amount_paid_cents: number | null

  documents_generated_at: string | null
  demand_letter_storage_path: string | null
  pre_lien_notice_storage_path: string | null
  notice_of_intent_storage_path: string | null
  lien_document_storage_path: string | null
  first_downloaded_at: string | null
  download_count: number

  created_at: string
  updated_at: string
}
