import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { inngestFunctions } from '@/lib/inngest-functions-registry'

export const runtime = 'nodejs'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
})
