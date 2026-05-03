import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import {
  runTrustJob,
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
} from '@/lib/trust/inngest-functions'

export const runtime = 'nodejs'

export const inngestFunctions = [
  runTrustJob,
  runTrustJobV2,
  runTrustSynthesizeV2,
  onTrustEvidenceAppended,
  onTrustReportCreated,
]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
})
