/** Type-only module. Industry baseline is computed by the
 *  compute_industry_baseline SQL function (mig 240) and written via the
 *  trust_reports_post_integrity_industry_baseline trigger. This file exports
 *  only the TS interface that mirrors that JSONB shape.
 */

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
