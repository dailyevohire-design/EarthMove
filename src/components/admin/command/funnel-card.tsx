import type { FunnelDef, FunnelStep } from '@/lib/admin/funnels'

const BAR_DEPTH_COLORS = [
  'bg-emerald-600',
  'bg-emerald-500',
  'bg-emerald-400',
  'bg-emerald-300',
  'bg-emerald-200',
]

export function FunnelCard({
  funnel,
  steps,
  error,
}: {
  funnel: FunnelDef
  steps: FunnelStep[]
  error?: string
}) {
  return (
    <div className="rounded-lg bg-white border border-stone-200 p-5">
      <header className="mb-4">
        <h3 className="font-serif text-lg text-stone-900">{funnel.title}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{funnel.subtitle}</p>
        <p className="text-[10px] uppercase tracking-wider text-stone-400 mt-2">
          Last {funnel.default_window_hours}h
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-medium text-red-800">Query failed</p>
          <p className="text-xs text-red-700 mt-0.5 break-all">{error}</p>
        </div>
      ) : steps.length === 0 || steps[0].uniq_count === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 p-8 text-center">
          <p className="text-xs text-stone-500">No traffic in this window</p>
        </div>
      ) : (
        <FunnelBody funnel={funnel} steps={steps} />
      )}
    </div>
  )
}

function FunnelBody({ funnel, steps }: { funnel: FunnelDef; steps: FunnelStep[] }) {
  const top = steps[0].uniq_count
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const label = funnel.step_labels[step.step_name] ?? step.step_name
        const widthPct = top > 0 ? Math.max(1, Math.round((step.uniq_count / top) * 100)) : 0
        const barCls = BAR_DEPTH_COLORS[Math.min(i, BAR_DEPTH_COLORS.length - 1)]

        return (
          <div key={step.step_name}>
            {i > 0 && (
              <div className="text-[11px] text-stone-500 text-center mb-2 -mt-1">
                ↓ -{Math.round(step.drop_pct)}%
              </div>
            )}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-stone-700">{label}</span>
              <span className="text-sm font-medium text-stone-900 tabular-nums">
                {step.uniq_count.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${barCls} rounded-full transition-all`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
