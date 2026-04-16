import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ContractorCheckClient from './ContractorCheckClient'

export const metadata = { title: 'Contractor Check — earthmove.io' }

export default async function ContractorCheckPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: history } = await admin
    .from('trust_reports')
    .select('id, contractor_name, city, state_code, trust_score, risk_level, confidence_level, summary, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <ContractorCheckClient initialHistory={history ?? []} />
}
