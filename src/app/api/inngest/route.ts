import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import {
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
} from '@/lib/trust/inngest-functions'
import { opsPagerOnOrderConfirmed } from '@/inngest/functions/ops-pager'
import { disasterIngestNws } from '@/inngest/functions/disaster-ingest-nws'
import { disasterIngestFema } from '@/inngest/functions/disaster-ingest-fema'
import { permitIngestAustin } from '@/inngest/functions/permit-ingest-austin'

export const runtime = 'nodejs'

export const inngestFunctions = [
  disasterIngestNws,
  disasterIngestFema,
  permitIngestAustin,
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
  opsPagerOnOrderConfirmed,
]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
})
