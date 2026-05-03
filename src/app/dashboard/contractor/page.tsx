import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveContractorAccess, isAuthorized } from '@/lib/contractor/access'
import { getCommandStats } from '@/lib/services/contractor-command.service'
import { PageHead } from '@/components/contractor/PageHead'
import { MetricCard } from '@/components/contractor/MetricCard'
import { AttentionQueue } from '@/components/contractor/AttentionQueue'
import { OpsMapPreview } from '@/components/contractor/OpsMapPreview'
import { MaterialSwatch } from '@/components/contractor/MaterialSwatch'
import Link from 'next/link'

export const metadata = { title: 'Command — earthmove.io' }

function fmtMoney(cents: number) {
  const d = cents / 100
  return '$' + d.toLocaleString('en-US', { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 })
}
function fmtDuration(mins: number | null) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}h ${m}m`
}
function statusChipClass(status: string) {
  if (status === 'confirmed')  return 'ec-chip ec-chip--confirmed'
  if (status === 'dispatched') return 'ec-chip ec-chip--dispatched'
  if (status === 'delivered')  return 'ec-chip ec-chip--delivered'
  if (status === 'needs_review') return 'ec-chip ec-chip--review'
  return 'ec-chip ec-chip--pending'
}

export default async function CommandPage() {
  const supabase = await createClient()
  const ctx = await resolveContractorAccess(supabase)
  if (ctx.access === 'unauth') redirect('/login')
  if (!isAuthorized(ctx)) redirect('/dashboard')

  const { profile, organizationId } = ctx

  // Stats
  let stats: Awaited<ReturnType<typeof getCommandStats>>
  try {
    stats = await getCommandStats(organizationId)
  } catch (err) {
    console.error('[command] stats failed:', err)
    stats = {
      active_orders_count: 0, trucks_en_route_count: 0,
      this_week_spend_cents: 0, this_week_delta_pct: null,
      avg_delivery_minutes: null, avg_delivery_delta_minutes: null,
      attention_queue: [], active_projects: [], recent_orders: [],
    }
  }

  // Market center for map preview
  let mapCenter: { lat: number; lng: number } | null = null
  if (profile.default_market_id) {
    const admin = createAdminClient()
    const { data: m } = await admin
      .from('markets').select('center_lat, center_lng')
      .eq('id', profile.default_market_id).maybeSingle()
    if (m?.center_lat && m?.center_lng) {
      mapCenter = { lat: Number(m.center_lat), lng: Number(m.center_lng) }
    }
  }

  // Map pins: projects with lat/lng + (future) active dispatches
  const pins = stats.active_projects
    .map(p => ({
      id: p.id, lat: (p as any).lat, lng: (p as any).lng, kind: 'project' as const, label: p.name,
    }))
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number') as Array<{ id: string; lat: number; lng: number; kind: 'dispatch' | 'project'; label: string }>

  const firstName = profile.first_name?.trim() || 'there'

  return (
    <>
      <div className="contractor-desktop">
      <PageHead
        kicker="Contractor OS"
        title={<>Good morning, <em>{firstName}</em></>}
        subtitle="Here's what's waiting for you today."
        right={
          <Link href="/dashboard/contractor/orders/new" className="ec-btn ec-btn--primary">
            + Place order
          </Link>
        }
      />

      {/* Row 1: 4 metric cards */}
      <section className="ec-grid" style={{ marginBottom: 24 }}>
        <div className="ec-col-3">
          <MetricCard
            label="Active orders"
            value={stats.active_orders_count.toLocaleString()}
            footer="confirmed + dispatched"
          />
        </div>
        <div className="ec-col-3">
          <MetricCard
            label="Trucks en route"
            value={stats.trucks_en_route_count.toLocaleString()}
            footer={stats.trucks_en_route_count > 0 ? 'on the road now' : 'all parked'}
          />
        </div>
        <div className="ec-col-3">
          <MetricCard
            label="This week spend"
            value={fmtMoney(stats.this_week_spend_cents)}
            footer="paid orders"
            delta={stats.this_week_delta_pct != null ? {
              value: `${Math.abs(stats.this_week_delta_pct)}%`,
              direction: stats.this_week_delta_pct > 0 ? 'up' : stats.this_week_delta_pct < 0 ? 'down' : 'flat',
            } : undefined}
          />
        </div>
        <div className="ec-col-3">
          <MetricCard
            label="Avg delivery time"
            value={fmtDuration(stats.avg_delivery_minutes)}
            footer="last 30 days"
          />
        </div>
      </section>

      {/* Row 2: map + attention queue */}
      <section className="ec-grid" style={{ marginBottom: 24 }}>
        <div className="ec-col-8">
          <OpsMapPreview
            center={mapCenter}
            pins={pins}
            height={420}
            footerStats={[
              { label: 'active', value: String(stats.active_orders_count) },
              { label: 'en route', value: String(stats.trucks_en_route_count) },
            ]}
          />
        </div>
        <div className="ec-col-4">
          <div className="ec-section">
            <div className="ec-section__head">
              <h2 className="ec-section__title">Needs your <em>attention</em></h2>
              <span className="ec-section__meta">{stats.attention_queue.length}</span>
            </div>
            <div className="ec-section__body">
              <AttentionQueue items={stats.attention_queue} />
            </div>
          </div>
        </div>
      </section>

      {/* Row 3: projects + recent orders */}
      <section className="ec-grid">
        <div className="ec-col-6">
          <div className="ec-section">
            <div className="ec-section__head">
              <h2 className="ec-section__title">Active <em>projects</em></h2>
              <Link href="/dashboard/contractor/projects" className="ec-section__meta">All projects →</Link>
            </div>
            <div className="ec-section__body">
              {stats.active_projects.length === 0 ? (
                <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-500)' }}>
                  No active projects yet. Create one to track spend vs budget.
                </div>
              ) : stats.active_projects.map(p => {
                const pct = p.budget_cents && p.budget_cents > 0
                  ? Math.min(100, Math.round((p.spend_cents / p.budget_cents) * 100))
                  : p.progress_pct
                return (
                  <article key={p.id} className="ec-proj">
                    <div className="ec-proj__top">
                      <span className="ec-proj__name">{p.name}</span>
                      <span className="ec-proj__phase">{p.phase_label ?? '—'}</span>
                    </div>
                    <div className="ec-proj__bar">
                      <div className={`ec-proj__bar-fill ${p.at_risk ? 'ec-proj__bar-fill--risk' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="ec-proj__money">
                      <span><strong>{fmtMoney(p.spend_cents)}</strong> spent</span>
                      <span>{p.budget_cents ? `of ${fmtMoney(p.budget_cents)}` : 'budget not set'}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>

        <div className="ec-col-6">
          <div className="ec-section">
            <div className="ec-section__head">
              <h2 className="ec-section__title">Recent <em>orders</em></h2>
              <Link href="/dashboard/contractor/orders/new" className="ec-section__meta">+ New</Link>
            </div>
            <div className="ec-section__body">
              {stats.recent_orders.length === 0 ? (
                <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-500)' }}>
                  No orders yet. Place your first one from the top-right.
                </div>
              ) : stats.recent_orders.map(o => (
                <div key={o.id} className="ec-order">
                  <MaterialSwatch slug={o.material_name_snapshot?.toLowerCase()} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-950)' }}>
                      {o.material_name_snapshot}
                    </div>
                    <div className="ec-order__meta">
                      {o.supplier_name_snapshot}  ·  {Number(o.quantity).toLocaleString()} {o.unit}
                    </div>
                  </div>
                  <span className="ec-order__amount">${Number(o.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={statusChipClass(o.status)}>{o.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* Mobile-native parallel block — visible only ≤767px */}
      <div className="contractor-mobile">
        <header className="cm-header">
          <div className="cm-eyebrow">Today · contractor brief</div>
          <button className="cm-chat" aria-label="Messages">⌕</button>
        </header>
        <h1 className="cm-greeting">Good morning, {firstName}</h1>

        <section className="cm-section">
          <div className="cm-section-head">
            <span className="eyebrow">In flight · {stats.trucks_en_route_count} loads</span>
            <Link href="/account/orders" className="see-all">See all</Link>
          </div>
          {stats.recent_orders.slice(0, 1).map(o => (
            <div key={o.id} className="cm-live-card">
              <span className="live-chip">LIVE</span>
              <span className="load-id">#{o.id.slice(-6).toUpperCase()}</span>
              <span className="load-eta">{o.status}</span>
              <div className="load-line">{Number(o.quantity).toLocaleString()} {o.unit} · {o.material_name_snapshot}</div>
              <div className="load-sub">{o.supplier_name_snapshot}</div>
            </div>
          ))}
        </section>

        <section className="cm-actions">
          <Link className="cm-action cm-action-primary" href="/dashboard/contractor/orders/new">
            <span>+ New order</span>
            <span className="cm-action-sub">Place a load</span>
          </Link>
          <Link className="cm-action" href="/account/orders">
            <span>Track all</span>
            <span className="cm-action-sub">{stats.trucks_en_route_count} en route</span>
          </Link>
        </section>

        <section className="cm-section">
          <div className="cm-section-head">
            <span className="eyebrow">Active jobs · {stats.active_projects.length}</span>
            <Link href="/dashboard/contractor/projects" className="see-all">Manage</Link>
          </div>
          {stats.active_projects.slice(0, 4).map(p => (
            <Link className="cm-job-row" key={p.id} href={`/dashboard/contractor/projects/${p.id}`}>
              <span className="cm-job-avatar">{p.name.slice(0, 2).toUpperCase()}</span>
              <span className="cm-job-info">
                <span className="cm-job-name">{p.name}</span>
                <span className="cm-job-meta">{fmtMoney(p.spend_cents)} spent</span>
              </span>
              <span className="cm-chev">→</span>
            </Link>
          ))}
        </section>

        <section className="cm-section">
          <div className="eyebrow">This week · spend</div>
          <div className="cm-week-spend">{fmtMoney(stats.this_week_spend_cents)}</div>
        </section>

        <nav className="bottom-tab-bar">
          <Link href="/browse">Browse</Link>
          <Link href="/account/orders">Orders</Link>
          <Link href="/dashboard/contractor" aria-current="page">Track</Link>
          <Link href="/account">Account</Link>
        </nav>
      </div>
    </>
  )
}
