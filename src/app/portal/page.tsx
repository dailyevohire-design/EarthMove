import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing-engine'

export const metadata = { title: 'My Offerings — Supplier Portal' }

export default async function PortalOfferingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('supplier_id').eq('id', user.id).single()
  if (!profile?.supplier_id) redirect('/')

  const { data: yards } = await supabase
    .from('supply_yards')
    .select(`
      id, name, city, state, is_active,
      offerings:supplier_offerings(
        id, price_per_unit, unit, is_available, is_public,
        minimum_order_quantity, last_verified_at,
        material:material_catalog(name, category:material_categories(name))
      )
    `)
    .eq('supplier_id', profile.supplier_id)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100">My Offerings</h1>
        <p className="text-stone-500 text-sm mt-1">
          Pricing and availability of your materials on the platform.
          Contact us to make changes.
        </p>
      </div>

      <div className="space-y-6">
        {(yards ?? []).map((yard: any) => (
          <div key={yard.id} className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-800 bg-stone-800/30">
              <div className="font-semibold text-stone-200">{yard.name}</div>
              <div className="text-stone-500 text-sm">{[yard.city, yard.state].filter(Boolean).join(', ')}</div>
            </div>

            {(yard.offerings ?? []).length === 0 ? (
              <div className="p-6 text-center text-stone-600 text-sm">No offerings for this yard.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-800">
                    {['Material', 'Category', 'Price', 'Min Order', 'Status', 'Last Verified'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/40">
                  {(yard.offerings as any[]).map((o: any) => (
                    <tr key={o.id} className={o.is_available ? '' : 'opacity-50'}>
                      <td className="px-5 py-3.5 font-medium text-stone-200">{o.material?.name}</td>
                      <td className="px-5 py-3.5 text-stone-500 text-xs">{o.material?.category?.name}</td>
                      <td className="px-5 py-3.5 font-semibold text-stone-200">
                        {formatCurrency(o.price_per_unit)}<span className="text-stone-600 font-normal">/{o.unit}</span>
                      </td>
                      <td className="px-5 py-3.5 text-stone-400">{o.minimum_order_quantity} {o.unit}</td>
                      <td className="px-5 py-3.5">
                        {o.is_available
                          ? <span className="badge-green">Available</span>
                          : <span className="badge-stone">Unavailable</span>}
                      </td>
                      <td className="px-5 py-3.5 text-stone-600 text-xs">
                        {o.last_verified_at
                          ? new Date(o.last_verified_at).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {(!yards || yards.length === 0) && (
          <div className="card p-12 text-center text-stone-500">
            No active yards found for your account.
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-stone-800/50 border border-stone-700 rounded-xl text-sm text-stone-400">
        <strong className="text-stone-300">Need to update your pricing or availability?</strong> Contact your account manager.
        Self-service editing is coming soon.
      </div>
    </div>
  )
}
