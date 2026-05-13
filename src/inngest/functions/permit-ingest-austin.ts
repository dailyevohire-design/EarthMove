import { inngest } from '@/lib/inngest';
import { createAdminClient } from '@/lib/supabase/server';
import { ingestAustinPermits } from '@/lib/permits/austin-ingest';

export const permitIngestAustin = inngest.createFunction(
  {
    id: 'permit-ingest-austin',
    name: 'Ingest Austin Open Data construction permits',
    triggers: [
      { cron: '0 */1 * * *' },
      { event: 'permit/ingest.austin.requested' },
    ],
    retries: 3,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    return await step.run('ingest-austin-permits', async () => {
      const supabase = createAdminClient();
      return await ingestAustinPermits(supabase);
    });
  }
);
