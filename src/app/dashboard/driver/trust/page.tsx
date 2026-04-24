import { isGroundcheckCheckoutEnabled } from '@/lib/trust/feature-flags'
import TrustClient from './TrustClient'

// Server parent so we can read the server-only feature flag and pass it as a
// prop to the client component. Avoids introducing NEXT_PUBLIC_.
export default function TrustPage() {
  return <TrustClient checkoutEnabled={isGroundcheckCheckoutEnabled()} />
}
