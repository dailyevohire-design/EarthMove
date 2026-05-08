/**
 * ScoreExplanationCard — patent-relevant transparency surface.
 * Direct competitive moat vs ISNetworld's black-box trust scoring.
 *
 * Shows:
 *   - Score arithmetic walk: base 100 → each adjustment → final.
 *   - Industry baseline section: state-level p25/median/p75 with the
 *     contractor's score marked. Plus percentile rank.
 *   - Empty-baseline state for under-sampled states.
 */

interface ScoreAdjustment {
  reason: string
  delta: number
  source: string
  evidence_id: string | null
}

export interface ScoreBreakdownProps {
  base_score: number
  adjustments: ScoreAdjustment[]
  final_score: number
}

export interface IndustryBaselineProps {
  state_code: string
  median_score: number
  p25_score: number
  p75_score: number
  mean_score: number
  sample_size: number
  percentile_rank: number | null
}

interface Props {
  breakdown: ScoreBreakdownProps | null | undefined
  baseline: IndustryBaselineProps | null | undefined
  finalScore: number | null
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function ScoreExplanationCard({ breakdown, baseline, finalScore }: Props) {
  if (!breakdown || finalScore === null) return null

  const positiveAdjustments = breakdown.adjustments.filter((a) => a.delta > 0)
  const negativeAdjustments = breakdown.adjustments.filter((a) => a.delta < 0)

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 ring-1 ring-stone-200">
          Why this score · Transparency
        </span>
        <h2 className="mt-2 text-lg font-semibold text-stone-900">How we got to {finalScore}/100</h2>
      </header>

      {/* Arithmetic walk */}
      <div className="mb-6">
        <div className="flex items-center justify-between py-2 border-b border-stone-100 text-sm">
          <span className="text-stone-700 font-semibold">Base score</span>
          <span className="font-mono text-stone-900">{breakdown.base_score}</span>
        </div>
        {negativeAdjustments.length > 0 && (
          <div className="mt-3 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1">Adverse signals</p>
            {negativeAdjustments.map((a, i) => (
              <div key={`n${i}`} className="flex items-center justify-between py-1 text-sm">
                <span className="text-stone-700 flex-1 mr-3">{a.reason}<span className="text-stone-400 ml-1">· {a.source}</span></span>
                <span className="font-mono text-red-700 shrink-0">{a.delta}</span>
              </div>
            ))}
          </div>
        )}
        {positiveAdjustments.length > 0 && (
          <div className="mt-3 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Positive signals</p>
            {positiveAdjustments.map((a, i) => (
              <div key={`p${i}`} className="flex items-center justify-between py-1 text-sm">
                <span className="text-stone-700 flex-1 mr-3">{a.reason}<span className="text-stone-400 ml-1">· {a.source}</span></span>
                <span className="font-mono text-emerald-700 shrink-0">+{a.delta}</span>
              </div>
            ))}
          </div>
        )}
        {breakdown.adjustments.length === 0 && (
          <p className="text-sm text-stone-500 my-3">No score adjustments — base score retained.</p>
        )}
        <div className="flex items-center justify-between py-2 border-t border-stone-200 text-sm font-bold">
          <span className="text-stone-900">Final score</span>
          <span className="font-mono text-stone-900">{breakdown.final_score}</span>
        </div>
      </div>

      {/* Industry baseline */}
      <div className="pt-4 border-t border-stone-100">
        <h3 className="text-sm font-semibold text-stone-900 mb-2">Industry context — {baseline?.state_code ?? 'state baseline'}</h3>
        {baseline ? (
          <>
            <p className="text-sm text-stone-600 mb-3">
              Among contractors searched in {baseline.state_code}, the median trust score is{' '}
              <span className="font-semibold text-stone-900">{baseline.median_score}</span> (sample: {baseline.sample_size}).
              {baseline.percentile_rank !== null && (
                <> You scored <span className="font-semibold text-stone-900">{finalScore}</span> — that&apos;s the {ordinal(baseline.percentile_rank)} percentile.</>
              )}
            </p>
            {/* Visual bar */}
            <div className="relative h-4 rounded-full bg-stone-100">
              {/* p25–p75 band */}
              <div
                className="absolute top-0 h-4 rounded-full bg-stone-300"
                style={{
                  left: `${baseline.p25_score}%`,
                  width: `${Math.max(2, baseline.p75_score - baseline.p25_score)}%`,
                }}
                title={`p25–p75: ${baseline.p25_score}–${baseline.p75_score}`}
              />
              {/* Median tick */}
              <div
                className="absolute top-0 h-4 w-px bg-stone-700"
                style={{ left: `${baseline.median_score}%` }}
                title={`Median: ${baseline.median_score}`}
              />
              {/* Contractor's score marker */}
              <div
                className="absolute -top-1 h-6 w-1 bg-emerald-600 rounded"
                style={{ left: `calc(${finalScore}% - 1px)` }}
                title={`Your score: ${finalScore}`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-mono text-stone-400">
              <span>0</span>
              <span>p25 {baseline.p25_score}</span>
              <span>median {baseline.median_score}</span>
              <span>p75 {baseline.p75_score}</span>
              <span>100</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500">
            Industry baseline not yet available for this state — we need more reports in this market to compute meaningful comparison. Standard launch markets: CO, TX.
          </p>
        )}
      </div>
    </section>
  )
}
