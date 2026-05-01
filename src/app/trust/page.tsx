import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
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

export default async function TrustPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let role: string | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = data?.role ?? null
  }
  return <TrustPublicClient isLoggedIn={!!user} role={role} />
}
