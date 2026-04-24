import { Suspense } from 'react'
import CheckoutProcessing from '@/components/trust/CheckoutProcessing'

export const metadata = { title: 'Finalizing purchase — earthmove.io' }

export default function DriverTrustProcessingPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutProcessing role="driver" />
    </Suspense>
  )
}
