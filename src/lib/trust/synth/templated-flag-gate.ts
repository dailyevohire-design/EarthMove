// Evidence-existence gates for the templated synthesis fallback.
// The templated path must NEVER fabricate red flags from score thresholds alone —
// every red flag emitted by the fallback must be backed by ≥1 trust_evidence row
// with a matching finding_type. This module is the single source of truth for
// which finding_types back which flag strings.
//
// Background: prior to 2026-05-14, the templated fallback stamped:
//   - "Phoenix-company pattern indicators present." when phoenix_score < 80
//   - "License shows suspended status." when score.license_suspended was truthy
// These stamped on every templated_after_stall fallback regardless of actual
// evidence. Customer-defamation vector. This module gates each.

import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOENIX_BACKING_FINDING_TYPES = [
  'phoenix_signal',
  'officer_match',
  'address_reuse',
  'phone_reuse',
  'ein_match',
] as const;

export const LICENSE_SUSPENDED_BACKING_FINDING_TYPES = [
  'license_suspended',
  'license_revoked',
  'license_revoked_but_operating',
  'license_disciplinary_action',
  'license_penalty_assessed',
] as const;

export const BUSINESS_INACTIVE_BACKING_FINDING_TYPES = [
  'business_inactive',
  'business_dissolved',
] as const;

export async function hasBackingEvidence(
  supabase: SupabaseClient,
  jobId: string,
  findingTypes: readonly string[],
): Promise<boolean> {
  if (!jobId || findingTypes.length === 0) return false;
  const { data, error } = await supabase
    .from('trust_evidence')
    .select('id')
    .eq('job_id', jobId)
    .in('finding_type', findingTypes as unknown as string[])
    .limit(1);
  if (error) {
    // Fail-closed: on query error, do not stamp the flag. Better a missed
    // legit flag than a fabricated one.
    console.warn('[templated-flag-gate] evidence lookup failed', { jobId, error });
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export interface TemplatedFlagGateInputs {
  supabase: SupabaseClient;
  jobId: string;
}

export interface EvidenceBackedFlags {
  phoenix: boolean;
  license_suspended: boolean;
  business_inactive: boolean;
}

/**
 * Returns the set of red flag strings the templated fallback is permitted to
 * emit for this job, based on which evidence families have ≥1 backing row.
 * Caller intersects this with whatever score-threshold logic would have fired
 * in the legacy path.
 */
export async function evidenceBackedFlags(
  inputs: TemplatedFlagGateInputs,
): Promise<EvidenceBackedFlags> {
  const { supabase, jobId } = inputs;
  const [phoenix, license_suspended, business_inactive] = await Promise.all([
    hasBackingEvidence(supabase, jobId, PHOENIX_BACKING_FINDING_TYPES),
    hasBackingEvidence(supabase, jobId, LICENSE_SUSPENDED_BACKING_FINDING_TYPES),
    hasBackingEvidence(supabase, jobId, BUSINESS_INACTIVE_BACKING_FINDING_TYPES),
  ]);
  return { phoenix, license_suspended, business_inactive };
}
