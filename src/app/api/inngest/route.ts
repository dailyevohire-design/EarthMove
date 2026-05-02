import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { runTrustJob, runTrustJobV2,
  runTrustSynthesizeV2,
} from '@/lib/trust/inngest-functions'

export const runtime = 'nodejs'

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [runTrustJob, runTrustJobV2,
    runTrustSynthesizeV2,
  ],
})
