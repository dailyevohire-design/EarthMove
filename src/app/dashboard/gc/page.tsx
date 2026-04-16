import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ShieldCheck, ShoppingCart, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react'

export const metadata = { title: 'Dashboard — earthmove.io' }

export default async function GCDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: reports } = await admin
    .from('trust_reports')
    .select('id, contractor_name, trust_score, risk_level, created_at, city, state_code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, material_name_snapshot, status, total_amount, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const highRisk = ((reports ?? []) as any[]).filter(r => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length
  const exposure = highRisk * 47000

  const RISK_COLOR: Record<string, string> = {
    LOW:      'text-emerald-600',
    MEDIUM:   'text-amber-600',
    HIGH:     'text-red-600',
    CRITICAL: 'text-red-700',
  }

  const RISK_SCORE_BG: Record<string, string> = {
    LOW:      'bg-emerald-600',
    MEDIUM:   'bg-amber-500',
    HIGH:     'bg-red-600',
    CRITICAL: 'bg-red-700',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Know who you&apos;re doing business with before you get burned.</p>
      </div>

      {/* Loss aversion risk banner */}
      {highRisk > 0 && (
        <div className="mb-6 flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-red-800">
              {highRisk} high-risk contractor{highRisk > 1 ? 's' : ''} in your recent lookups
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              Estimated exposure: <span className="font-bold">${exposure.toLocaleString()}</span> avg cost per unverified incident
            </div>
          </div>
          <Link href="/dashboard/gc/contractors" className="text-xs font-bold text-red-700 hover:text-red-900 transition-colors whitespace-nowrap">
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
          <div key={s.label} className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
              <span className="text-gray-400">{s.icon}</span><span className="font-semibold tracking-wide">{s.label}</span>
            </div>
            <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent contractor checks */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="font-bold text-gray-900 text-sm">Recent Contractor Checks</div>
            <Link href="/dashboard/gc/contractors" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Run new check →
            </Link>
          </div>
          {(reports ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} className="text-emerald-500" />
              </div>
              <div className="text-gray-700 text-sm font-semibold">No contractors checked yet</div>
              <div className="text-gray-400 text-xs mt-1 mb-4">Verify a sub before your next project</div>
              <Link href="/dashboard/gc/contractors" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                Run your first check →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(reports as any[]).map(r => (
                <Link
                  key={r.id}
                  href="/dashboard/gc/contractors"
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{r.contractor_name}</div>
                    <div className="text-xs text-gray-400">{r.city}, {r.state_code}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${RISK_SCORE_BG[r.risk_level] ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <span className="text-xs font-black text-white">{r.trust_score}</span>
                    </div>
                    <div className={`text-[10px] font-bold ${RISK_COLOR[r.risk_level] ?? 'text-gray-500'}`}>
                      {r.risk_level}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="font-bold text-gray-900 text-sm">Recent Orders</div>
            <Link href="/browse" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Order materials →
            </Link>
          </div>
          {(orders ?? []).length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No orders yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(orders as any[]).map(o => (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{o.material_name_snapshot}</div>
                    <div className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">${(o.total_amount / 100).toFixed(2)}</div>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{o.status}</span>
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
