import { inngest } from '@/lib/inngest';
import { createAdminClient } from '@/lib/supabase/server';
import { ingestFemaDisasters } from '@/lib/disasters/fema-ingest';

export const disasterIngestFema = inngest.createFunction(
  {
    id: 'disaster-ingest-fema',
    name: 'Ingest FEMA disaster declarations',
    triggers: [
      { cron: '0 */1 * * *' },
      { event: 'disaster/ingest.fema.requested' },
    ],
    retries: 3,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    return await step.run('ingest-fema-disasters', async () => {
      const supabase = createAdminClient();
      return await ingestFemaDisasters(supabase);
    });
  }
);
