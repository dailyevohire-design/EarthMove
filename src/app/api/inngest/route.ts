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

export const runtime = 'nodejs'

export const inngestFunctions = [
  disasterIngestNws,
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
