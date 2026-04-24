import { Suspense } from 'react'
import CheckoutProcessing from '@/components/trust/CheckoutProcessing'

export const metadata = { title: 'Finalizing purchase — earthmove.io' }

export default function GcTrustProcessingPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutProcessing role="gc" />
    </Suspense>
  )
}
