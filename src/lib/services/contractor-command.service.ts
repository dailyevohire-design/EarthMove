import { createAdminClient } from '@/lib/supabase/server'
import { listActiveProjects, type ProjectRow } from './project.service'
import type { AttentionItem } from '@/components/contractor/AttentionQueue'

export type CommandStats = {
  active_orders_count: number
  trucks_en_route_count: number
  this_week_spend_cents: number
  this_week_delta_pct: number | null
  avg_delivery_minutes: number | null
  avg_delivery_delta_minutes: number | null
  attention_queue: AttentionItem[]
  active_projects: Array<Pick<ProjectRow, 'id' | 'name' | 'phase_label' | 'progress_pct' | 'budget_cents' | 'spend_cents' | 'at_risk'>>
  recent_orders: Array<{
    id: string
    material_name_snapshot: string
    supplier_name_snapshot: string
    quantity: number
    unit: string
    total_amount: number
    status: string
    created_at: string
  }>
}

function weekStart(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  return x
}

export async function getCommandStats(organizationId: string): Promise<CommandStats> {
  const db = createAdminClient()
  const now = new Date()
  const wkStart = weekStart(now)
  const prevWkStart = new Date(wkStart); prevWkStart.setDate(prevWkStart.getDate() - 7)

  const orgOrders = db
    .from('orders')
    .select('id, status, material_name_snapshot, supplier_name_snapshot, quantity, unit, total_amount, created_at, dispatched_at, delivered_at, project_id, placed_by_profile_id, paid_at')

  // Counts
  const [{ count: activeCount }, { count: trucksCount }] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'dispatched'])
      .eq('project_id', organizationId).or(`placed_by_profile_id.eq.${organizationId}`),
    db.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'dispatched'),
  ])

  // Spend this week + last week (for delta). Uses paid_at for cash-basis.
  const { data: spendRows } = await orgOrders
    .gte('paid_at', prevWkStart.toISOString())
    .or(`project_id.in.(${await orgProjectIds(organizationId)})`)
    .order('paid_at', { ascending: false })

  const thisWeekSpend = sumRows(spendRows, wkStart)
  const lastWeekSpend = sumRowsBetween(spendRows, prevWkStart, wkStart)
  const thisWeekDelta = lastWeekSpend > 0
    ? Math.round(((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100)
    : null

  // Avg delivery time (minutes) over last 30d
  const since30 = new Date(now); since30.setDate(since30.getDate() - 30)
  const { data: doneRows } = await db
    .from('orders')
    .select('dispatched_at, delivered_at')
    .not('dispatched_at', 'is', null).not('delivered_at', 'is', null)
    .gte('delivered_at', since30.toISOString())
    .limit(500)
  const avgMinutes = avgDeliveryMinutes(doneRows)

  // Active projects
  const projects = await listActiveProjects(organizationId, 3).catch(() => [])

  // Recent orders
  const { data: recent } = await db
    .from('orders')
    .select('id, material_name_snapshot, supplier_name_snapshot, quantity, unit, total_amount, status, created_at, placed_by_profile_id, project_id')
    .order('created_at', { ascending: false }).limit(5)

  // Attention queue — derived synthesis (T2 will replace with real signals)
  const attention: AttentionItem[] = []
  if ((trucksCount ?? 0) > 0) {
    attention.push({
      kind: 'trucks_moving',
      message: `${trucksCount} truck${trucksCount === 1 ? '' : 's'} en route right now`,
      cta_href: '/dashboard/contractor/track', cta_label: 'Track',
      severity: 'info',
    })
  }
  for (const p of projects.filter(p => p.at_risk).slice(0, 2)) {
    attention.push({
      kind: 'project_at_risk',
      message: `${p.name} flagged at risk${p.phase_label ? ` (${p.phase_label})` : ''}`,
      cta_href: `/dashboard/contractor/projects`, cta_label: 'Review',
      severity: 'alert',
    })
  }

  return {
    active_orders_count: activeCount ?? 0,
    trucks_en_route_count: trucksCount ?? 0,
    this_week_spend_cents: thisWeekSpend,
    this_week_delta_pct: thisWeekDelta,
    avg_delivery_minutes: avgMinutes,
    avg_delivery_delta_minutes: null,
    attention_queue: attention,
    active_projects: projects.map(p => ({
      id: p.id, name: p.name, phase_label: p.phase_label,
      progress_pct: p.progress_pct, budget_cents: p.budget_cents,
      spend_cents: p.spend_cents, at_risk: p.at_risk,
    })),
    recent_orders: (recent ?? []).map((r: any) => ({
      id: r.id,
      material_name_snapshot: r.material_name_snapshot,
      supplier_name_snapshot: r.supplier_name_snapshot,
      quantity: Number(r.quantity),
      unit: r.unit,
      total_amount: Number(r.total_amount),
      status: r.status,
      created_at: r.created_at,
    })),
  }
}

async function orgProjectIds(organizationId: string): Promise<string> {
  const db = createAdminClient()
  const { data } = await db.from('projects').select('id').eq('organization_id', organizationId)
  const ids = (data ?? []).map((r: any) => r.id as string)
  return ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'
}

function sumRows(rows: any[] | null, since: Date): number {
  if (!rows) return 0
  return rows
    .filter(r => r.paid_at && new Date(r.paid_at) >= since)
    .reduce((s, r) => s + Math.round(Number(r.total_amount || 0) * 100), 0)
}
function sumRowsBetween(rows: any[] | null, from: Date, to: Date): number {
  if (!rows) return 0
  return rows
    .filter(r => r.paid_at && new Date(r.paid_at) >= from && new Date(r.paid_at) < to)
    .reduce((s, r) => s + Math.round(Number(r.total_amount || 0) * 100), 0)
}
function avgDeliveryMinutes(rows: any[] | null): number | null {
  if (!rows || rows.length === 0) return null
  const spans = rows.map(r => (new Date(r.delivered_at).getTime() - new Date(r.dispatched_at).getTime()) / 60000).filter(n => n > 0)
  if (!spans.length) return null
  return Math.round(spans.reduce((s, n) => s + n, 0) / spans.length)
}
