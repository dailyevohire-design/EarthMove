import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { OrderDraftPayloadSchema, highestCompleteStep, type OrderDraftPayload } from '@/lib/contractor/wizard-state'
import { listActiveProjects } from '@/lib/services/project.service'
import { WizardClient } from './_wizard/WizardClient'
import type { MaterialOption } from './_wizard/Step1Material'
import type { AddressRow, ProjectOption } from './_wizard/Step4Address'

export const metadata = { title: 'Place order — earthmove.io' }

type Search = { draft?: string }

export default async function PlaceOrderPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { draft: draftQuery } = await searchParams
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') redirect('/login')
  if (!isAuthorized(ctx)) redirect('/dashboard')

  // 1. Load or create the draft
  let draftId: string | null = draftQuery ?? null
  let payload: OrderDraftPayload = {}
  let step: 1 | 2 | 3 | 4 | 5 = 1

  if (!draftId) {
    const { data: latest } = await supabase
      .from('order_drafts').select('id, step, payload, last_saved_at')
      .eq('profile_id', ctx.userId)
      .order('last_saved_at', { ascending: false }).limit(1).maybeSingle()
    if (latest && within7Days(latest.last_saved_at)) {
      draftId = latest.id
      const parsed = OrderDraftPayloadSchema.safeParse(latest.payload ?? {})
      payload = parsed.success ? parsed.data : {}
      step = (latest.step as 1 | 2 | 3 | 4 | 5) ?? highestCompleteStep(payload)
    }
  } else {
    const { data: d } = await supabase
      .from('order_drafts').select('id, step, payload').eq('id', draftId).eq('profile_id', ctx.userId).maybeSingle()
    if (d) {
      const parsed = OrderDraftPayloadSchema.safeParse(d.payload ?? {})
      payload = parsed.success ? parsed.data : {}
      step = (d.step as 1 | 2 | 3 | 4 | 5) ?? highestCompleteStep(payload)
    } else {
      draftId = null
    }
  }

  if (!draftId) {
    const { data: created } = await supabase
      .from('order_drafts').insert({ profile_id: ctx.userId, step: 1, payload: {} }).select('id').single()
    draftId = created!.id
  }

  // 2. Load reference data server-side
  const admin = createAdminClient()

  const [{ data: materials }, { data: addresses }, projects, { data: profileFull }] = await Promise.all([
    admin.from('material_catalog')
      .select('id, name, slug, default_unit, density_tons_per_cuyd, category:material_categories(name)')
      .eq('is_active', true).order('sort_order', { ascending: true }).order('name', { ascending: true }),
    admin.from('addresses')
      .select('id, label, street_line_1, street_line_2, city, state, zip, is_default')
      .eq('profile_id', ctx.userId).order('is_default', { ascending: false }),
    listActiveProjects(ctx.organizationId, 50).catch(() => []),
    admin.from('profiles')
      .select('default_market_id').eq('id', ctx.userId).maybeSingle(),
  ])

  const profileZip: string | null = null  // derive if we add it later; profileFull.default_market gives lat/lng not zip

  const materialOptions: MaterialOption[] = (materials ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    category_name: m.category?.name ?? null,
    default_unit: (m.default_unit === 'cuyd' ? 'cuyd' : 'ton'),
  }))

  const addressRows: AddressRow[] = (addresses ?? []).map((a: any) => ({
    id: a.id, label: a.label, street_line_1: a.street_line_1, street_line_2: a.street_line_2 ?? null,
    city: a.city, state: a.state, zip: a.zip,
  }))

  const projectOptions: ProjectOption[] = projects.map(p => ({
    id: p.id, name: p.name, phase_label: p.phase_label,
  }))

  // Silence unused warning — profileFull reserved for future ZIP inference.
  void profileFull

  return (
    <WizardClient
      profileId={ctx.userId}
      profileZip={profileZip}
      canPlaceOrders={ctx.permissions.can_place_orders}
      spendLimitCents={ctx.permissions.spend_limit_cents}
      draftId={draftId!}
      initialPayload={payload}
      initialStep={step}
      materials={materialOptions}
      addresses={addressRows}
      projects={projectOptions}
    />
  )
}

function within7Days(iso?: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000
}
