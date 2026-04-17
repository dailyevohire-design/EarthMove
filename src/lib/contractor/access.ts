import type { SupabaseClient } from '@supabase/supabase-js'

export type ContractorProfile = {
  id: string
  role: 'customer' | 'supplier' | 'admin' | 'gc' | 'driver'
  first_name: string | null
  last_name: string | null
  company_name: string | null
  default_market_id: string | null
}

export type ContractorTeamMember = {
  organization_id: string
  role: string
  can_place_orders: boolean
  can_approve_orders: boolean
  can_view_billing: boolean
  can_manage_team: boolean
  spend_limit_cents: number | null
}

export type ContractorAccess =
  | { access: 'unauth' }
  | { access: 'no_profile'; userId: string }
  | { access: 'denied';     userId: string; profile: ContractorProfile }
  | {
      access: 'admin' | 'org_owner' | 'team_member'
      userId: string
      profile: ContractorProfile
      organizationId: string
      teamMember: ContractorTeamMember | null
      permissions: {
        can_place_orders: boolean
        can_approve_orders: boolean
        can_view_billing: boolean
        can_manage_team: boolean
        spend_limit_cents: number | null
      }
    }

// Resolves contractor-dashboard access. Matches the DB's org gate:
//   - admin: full access
//   - role='gc': org owner (organizationId = profile.id)
//   - active team_members row: team_member (organizationId = tm.organization_id)
export async function resolveContractorAccess(supabase: SupabaseClient): Promise<ContractorAccess> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { access: 'unauth' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name, company_name, default_market_id')
    .eq('id', user.id).maybeSingle()
  if (!profile) return { access: 'no_profile', userId: user.id }

  const p = profile as ContractorProfile

  if (p.role === 'admin') {
    return {
      access: 'admin', userId: user.id, profile: p,
      organizationId: p.id, teamMember: null,
      permissions: { can_place_orders: true, can_approve_orders: true, can_view_billing: true, can_manage_team: true, spend_limit_cents: null },
    }
  }

  if (p.role === 'gc') {
    return {
      access: 'org_owner', userId: user.id, profile: p,
      organizationId: p.id, teamMember: null,
      permissions: { can_place_orders: true, can_approve_orders: true, can_view_billing: true, can_manage_team: true, spend_limit_cents: null },
    }
  }

  const { data: tm } = await supabase
    .from('team_members')
    .select('organization_id, role, can_place_orders, can_approve_orders, can_view_billing, can_manage_team, spend_limit_cents')
    .eq('user_id', user.id).eq('active', true).maybeSingle()

  if (tm) {
    const t = tm as ContractorTeamMember
    return {
      access: 'team_member', userId: user.id, profile: p,
      organizationId: t.organization_id, teamMember: t,
      permissions: {
        can_place_orders:   t.can_place_orders,
        can_approve_orders: t.can_approve_orders,
        can_view_billing:   t.can_view_billing,
        can_manage_team:    t.can_manage_team,
        spend_limit_cents:  t.spend_limit_cents,
      },
    }
  }

  return { access: 'denied', userId: user.id, profile: p }
}

export function isAuthorized(ctx: ContractorAccess): ctx is Extract<ContractorAccess, { access: 'admin' | 'org_owner' | 'team_member' }> {
  return ctx.access === 'admin' || ctx.access === 'org_owner' || ctx.access === 'team_member'
}
