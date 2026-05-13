/**
 * Inngest wrapper around ingestNwsActiveAlerts.
 *
 * Triggers:
 *   - cron every 10 minutes
 *   - manual event 'disaster/ingest.nws.requested' (for ad-hoc reruns)
 *
 * Deploy steps:
 *   1. Add `disasterIngestNws` to the inngestFunctions array in
 *      src/app/api/inngest/route.ts
 *   2. Commit + push
 *   3. After Vercel deploy: resync at app.inngest.com
 *      (Apps -> earthmove -> Resync). New functions don't auto-pick-up.
 */

import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { ingestNwsActiveAlerts } from '@/lib/disasters/nws-ingest'

export const disasterIngestNws = inngest.createFunction(
  {
    id: 'disaster-ingest-nws',
    name: 'Ingest NWS active disaster alerts',
    triggers: [
      { cron: '*/10 * * * *' },
      { event: 'disaster/ingest.nws.requested' },
    ],
    retries: 3,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const summary = await step.run('ingest-nws-active', async () => {
      const supabase = createAdminClient()
      return await ingestNwsActiveAlerts(supabase)
    })
    return summary
  }
)
