import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Inngest } from 'inngest';

const inngest = new Inngest({ id: 'retrigger-brannan', eventKey: process.env.INNGEST_EVENT_KEY! });

(async () => {
  const job_id = 'f3ff186a-9194-40d5-a68a-49dc3498b57b';
  await inngest.send({ name: 'trust/job.requested.v2', data: { job_id } });
  console.log(`re-triggered trust/job.requested.v2 for ${job_id}`);
})();
