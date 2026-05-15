import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

type MissionRow = {
  meals_committed_total: number
  meals_goal: number
  partner_name: string | null
}

export async function MissionCounter() {
  let mission: MissionRow | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('mission_progress')
      .select('meals_committed_total, meals_goal, partner_name')
      .eq('id', 'feeding_america_2026')
      .maybeSingle()
    if (data) mission = data as MissionRow
  } catch {
    /* graceful: render the headline-only fallback below */
  }

  if (!mission) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 my-6 max-w-3xl mx-auto">
        <p className="text-sm font-medium text-emerald-900">
          Committed to providing 1.5 million meals through our partnership with Feeding America&reg;
        </p>
        <p className="mt-2 text-[10px] text-stone-500 leading-tight">
          *$1 helps provide at least 10 meals secured by Feeding America&reg; on
          behalf of local partner food banks.
        </p>
      </section>
    )
  }

  const pct = Math.min(100, (mission.meals_committed_total / mission.meals_goal) * 100)

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 my-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-medium text-emerald-900">
          Meals committed through our Feeding America&reg; partnership
        </p>
        <p className="text-sm font-mono text-emerald-900">
          {mission.meals_committed_total.toLocaleString()} / {mission.meals_goal.toLocaleString()}
        </p>
      </div>
      <div className="mt-3 h-2 rounded bg-emerald-200">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-emerald-800">
        {pct.toFixed(1)}% of the way to our 1.5 million meal goal.
      </p>
      <p className="mt-2 text-[10px] text-stone-500 leading-tight">
        *$1 helps provide at least 10 meals secured by Feeding America&reg; on
        behalf of local partner food banks.
      </p>
    </section>
  )
}
