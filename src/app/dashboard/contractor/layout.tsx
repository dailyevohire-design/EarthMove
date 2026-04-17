import './contractor.css'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { ContractorShell } from './_shell/ContractorShell'

export const metadata = { title: 'Contractor — earthmove.io' }

async function fetchAlertCount(_orgId: string): Promise<number> {
  // Placeholder: /api/contractor/command-stats returns a count of attention items.
  // Rather than round-trip internally, we'll resolve this inside the Command page
  // and surface an approximation here. For Tranche 1, return 0 — the TopBar dot
  // is wired up and ready when we feed real numbers in T2.
  return 0
}

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)

  if (ctx.access === 'unauth') redirect('/login')
  if (!isAuthorized(ctx)) redirect('/dashboard')

  const { profile, organizationId } = ctx
  const first = profile.first_name?.trim() || ''
  const last  = profile.last_name?.trim()  || ''
  const orgName = profile.company_name?.trim()
    || [first, last].filter(Boolean).join(' ')
    || 'Contractor'
  const userDisplay = [first, last].filter(Boolean).join(' ') || profile.id.slice(0, 8)
  const initials = [first[0], last[0]].filter(Boolean).join('').toUpperCase() || 'C'

  const alertCount = await fetchAlertCount(organizationId)

  return (
    <ContractorShell
      orgName={orgName}
      userDisplay={userDisplay}
      initials={initials}
      alertCount={alertCount}
    >
      {children}
    </ContractorShell>
  )
}
