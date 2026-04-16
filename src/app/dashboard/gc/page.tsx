import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShieldCheck, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'

export const metadata = { title: 'Dashboard — earthmove.io' }

export default async function GCDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Load their recent trust reports
  const { data: reports } = await admin
    .from('trust_reports')
    .select('id, contractor_name, trust_score, risk_level, created_at, city, state_code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Load their recent orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, material_name_snapshot, status, total_amount, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const highRisk = (reports ?? []).filter(r => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length
  const exposure = highRisk * 47000

  const RISK_COLOR: Record<string, string> = {
    LOW:      'text-emerald-400',
    MEDIUM:   'text-amber-400',
    HIGH:     'text-red-400',
    CRITICAL: 'text-purple-400',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Know who you&apos;re doing business with before you get burned.</p>
      </div>

      {/* Loss aversion risk banner */}
      {highRisk > 0 && (
        <div className="mb-6 flex items-center gap-4 bg-red-950/60 border border-red-900 rounded-xl p-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-300">
              {highRisk} high-risk contractor{highRisk > 1 ? 's' : ''} in your recent lookups
            </div>
            <div className="text-xs text-red-400/80 mt-0.5">
              Estimated exposure: <span className="font-bold">${exposure.toLocaleString()}</span> avg cost per unverified incident
            </div>
          </div>
          <Link href="/dashboard/gc/contractors" className="text-xs font-semibold text-red-300 hover:text-red-100 transition-colors whitespace-nowrap">
            Review now →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Contractors checked',  value: (reports ?? []).length, icon: <ShieldCheck size={16} /> },
          { label: 'High risk found',       value: highRisk,               icon: <AlertTriangle size={16} /> },
          { label: 'Orders placed',         value: (orders ?? []).length,  icon: <ShoppingCart size={16} /> },
          { label: 'Avg cost per incident', value: '$47K',                 icon: <TrendingUp size={16} /> },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              {s.icon}<span>{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-stone-100">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent contractor checks */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
            <div className="font-semibold text-stone-200 text-sm">Recent Contractor Checks</div>
            <Link href="/dashboard/gc/contractors" className="text-xs text-emerald-500 hover:text-emerald-400">
              Run new check →
            </Link>
          </div>
          {(reports ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck size={32} className="text-stone-700 mx-auto mb-3" />
              <div className="text-stone-400 text-sm font-medium">No contractors checked yet</div>
              <div className="text-stone-600 text-xs mt-1 mb-4">Verify a sub before your next project</div>
              <Link href="/dashboard/gc/contractors" className="text-xs font-semibold text-emerald-500 hover:text-emerald-400">
                Run your first check →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-800/60">
              {(reports as any[]).map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-stone-200">{r.contractor_name}</div>
                    <div className="text-xs text-stone-600">{r.city}, {r.state_code}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${RISK_COLOR[r.risk_level] ?? 'text-stone-400'}`}>
                      {r.trust_score}
                    </div>
                    <div className="text-[10px] text-stone-600">{r.risk_level}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
            <div className="font-semibold text-stone-200 text-sm">Recent Orders</div>
            <Link href="/browse" className="text-xs text-emerald-500 hover:text-emerald-400">
              Order materials →
            </Link>
          </div>
          {(orders ?? []).length === 0 ? (
            <div className="p-8 text-center text-stone-600 text-sm">No orders yet.</div>
          ) : (
            <div className="divide-y divide-stone-800/60">
              {(orders as any[]).map(o => (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-stone-200">{o.material_name_snapshot}</div>
                    <div className="text-xs text-stone-600">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-stone-300">${(o.total_amount / 100).toFixed(2)}</div>
                    <span className="badge-stone text-[10px]">{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
