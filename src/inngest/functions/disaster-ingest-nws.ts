/**
 * Inngest wrapper around ingestNwsActiveAlerts.
 *
 * Triggers:
 *   - cron every 10 minutes
 *   - manual event 'disaster/ingest.nws.requested' (for ad-hoc reruns)
 *
 * Deploy steps:
 *   1. Add `disasterIngestNws` to the functions array in
 *      src/app/api/inngest/route.ts
 *   2. Commit + push
 *   3. After Vercel deploy: resync at app.inngest.com
 *      (Apps -> earthmove -> Resync). New functions don't auto-pick-up.
 *
 * Env required at runtime:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/inngest/client';
import { ingestNwsActiveAlerts } from '@/lib/disasters/nws-ingest';

function makeSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const disasterIngestNws = inngest.createFunction(
  {
    id: 'disaster-ingest-nws',
    name: 'Ingest NWS active disaster alerts',
    retries: 3,
    concurrency: { limit: 1 },
  },
  [
    { cron: '*/10 * * * *' },
    { event: 'disaster/ingest.nws.requested' },
  ],
  async ({ step }) => {
    const summary = await step.run('ingest-nws-active', async () => {
      const supabase = makeSupabaseServiceClient();
      return await ingestNwsActiveAlerts(supabase);
    });
    return summary;
  }
);
