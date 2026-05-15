import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'

export const sweepStaleSnoozedCards = inngest.createFunction(
  {
    id: 'sweep-stale-snoozed-cards',
    name: 'Intervention cards: unsnooze cards whose snooze window has elapsed',
    triggers: [{ cron: '*/5 * * * *' }],
    retries: 2,
  },
  async ({ step }) => {
    const supabase = createAdminClient()

    const unsnoozed = await step.run('unsnooze', async () => {
      const { data, error } = await supabase
        .from('intervention_cards')
        .update({
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'snoozed')
        .lte('snoozed_until', new Date().toISOString())
        .select('id')
      if (error) throw error
      return data ?? []
    })

    return { cards_unsnoozed: unsnoozed.length }
  }
)
