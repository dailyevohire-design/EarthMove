import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'

type AbandonCandidate = {
  user_id: string
  phone: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  last_click_at: string
  last_click_target: string | null
  search_count_7d: number
  search_queries: unknown
}

export const groundcheckAbandonRecoverable = inngest.createFunction(
  {
    id: 'groundcheck-abandon-recoverable',
    name: 'Groundcheck: surface recovery cards for upgrade-abandoning users',
    triggers: [{ cron: '*/15 * * * *' }],
    retries: 2,
  },
  async ({ step }) => {
    const supabase = createAdminClient()

    const candidates = await step.run('detect-candidates', async () => {
      const { data, error } = await supabase.rpc('detect_groundcheck_abandon_candidates', {
        since_click_hours: 24,
        min_click_age_minutes: 30,
        min_searches_7d: 3,
      })
      if (error) throw error
      return (data ?? []) as AbandonCandidate[]
    })

    if (candidates.length === 0) {
      return { candidates_found: 0, cards_created: 0 }
    }

    // ISO year-week for dedup key (one card per user per week, max)
    const now = new Date()
    const isoYear = now.getUTCFullYear()
    const startOfYear = new Date(Date.UTC(isoYear, 0, 1))
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
    const isoWeek = String(Math.ceil((days + startOfYear.getUTCDay() + 1) / 7)).padStart(2, '0')
    const weekKey = `${isoYear}W${isoWeek}`

    let cardsCreated = 0
    for (const c of candidates) {
      const created: string | null = await step.run(`upsert-card-${c.user_id}`, async () => {
        const dedupKey = `groundcheck_abandon:${c.user_id}:${weekKey}`
        const displayName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || 'Customer'
        const minutesAgo = Math.round((Date.now() - new Date(c.last_click_at).getTime()) / 60000)

        const title = `${displayName} clicked upgrade but didn't convert`
        const body = `Ran ${c.search_count_7d} searches in last 7 days. Clicked upgrade ${minutesAgo} min ago. Target tier: ${c.last_click_target ?? 'pro'}.`

        const promoCopy = `Hey ${c.first_name || 'there'} — saw you were checking out contractors on Groundcheck. Here's 10% off your first month: GROUND10. - John`

        const { data, error } = await supabase
          .from('intervention_cards')
          .insert({
            rule_key: 'groundcheck_abandon_recoverable',
            entity_type: 'customer',
            entity_id: c.user_id,
            severity: 'warn',
            title,
            body,
            status: 'open',
            dedup_key: dedupKey,
            payload: {
              phone: c.phone,
              first_name: c.first_name,
              last_name: c.last_name,
              company_name: c.company_name,
              search_count_7d: c.search_count_7d,
              last_click_at: c.last_click_at,
              last_click_target: c.last_click_target,
              search_queries: c.search_queries,
              suggested_action: {
                type: 'sms_promo',
                copy: promoCopy,
              },
            },
          })
          .select('id')
          .maybeSingle()

        if (error) {
          // 23505 = unique_violation = dedup hit, expected; swallow
          if (error.code === '23505') return null
          throw error
        }
        return (data?.id as string | undefined) ?? null
      })
      if (created) cardsCreated++
    }

    return {
      candidates_found: candidates.length,
      cards_created: cardsCreated,
      week_key: weekKey,
    }
  }
)
