/**
 * Industry baseline lookup. Reads mv_state_score_baseline (mig 231) and
 * approximates the contractor's percentile rank from the four-point
 * distribution (p25, median, p75). Best-effort — returns null when no
 * baseline data exists for the state.
 *
 * Lives independent of the SQL scoring pipeline. Baseline is unrelated to
 * scoring methodology — it's a presentation surface for the
 * ScoreExplanationCard percentile widget.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface IndustryBaseline {
  scope: 'state'
  state_code: string
  median_score: number
  p25_score: number
  p75_score: number
  mean_score: number
  sample_size: number
  computed_at: string | null
  percentile_rank: number | null
}

export async function computeIndustryBaseline(
  stateCode: string,
  supabase: SupabaseClient,
  contractorScore: number | null = null,
): Promise<IndustryBaseline | null> {
  if (!stateCode) return null
  const { data, error } = await supabase
    .from('mv_state_score_baseline')
    .select('state_code, sample_size, mean_score, median_score, p25_score, p75_score, computed_at')
    .eq('state_code', stateCode.toUpperCase())
    .maybeSingle()

  if (error || !data) return null

  let percentile: number | null = null
  if (typeof contractorScore === 'number') {
    const p25 = Number(data.p25_score)
    const median = Number(data.median_score)
    const p75 = Number(data.p75_score)
    if (contractorScore <= p25) {
      percentile = Math.round((contractorScore / Math.max(p25, 1)) * 25)
    } else if (contractorScore <= median) {
      percentile = Math.round(25 + ((contractorScore - p25) / Math.max(median - p25, 1)) * 25)
    } else if (contractorScore <= p75) {
      percentile = Math.round(50 + ((contractorScore - median) / Math.max(p75 - median, 1)) * 25)
    } else {
      percentile = Math.round(75 + ((contractorScore - p75) / Math.max(100 - p75, 1)) * 25)
      percentile = Math.min(99, percentile)
    }
    percentile = Math.max(0, Math.min(99, percentile))
  }

  return {
    scope: 'state',
    state_code: data.state_code as string,
    median_score: Number(data.median_score),
    p25_score: Number(data.p25_score),
    p75_score: Number(data.p75_score),
    mean_score: Number(data.mean_score),
    sample_size: Number(data.sample_size),
    computed_at: (data.computed_at as string | null) ?? null,
    percentile_rank: percentile,
  }
}
