import type { Metadata } from 'next'
import { TrustPublicClient } from './TrustPublicClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Groundcheck — Know who you're hiring before you sign",
  description:
    'Independent contractor trust verification. 0–100 trust score, plain-language verdict, full breakdown by category. Run your first check free.',
  alternates: { canonical: '/trust' },
  openGraph: {
    title: 'Groundcheck by EarthMove',
    description:
      "Independent contractor trust verification. Know who you're hiring before you sign.",
    url: '/trust',
    type: 'website',
  },
}

export default function TrustPage() {
  return <TrustPublicClient />
}
