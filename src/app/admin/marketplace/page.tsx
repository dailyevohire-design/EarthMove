import { createAdminClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing-engine'
import Link from 'next/link'
import { Eye, EyeOff, Star, ArrowRight, Plus } from 'lucide-react'

export const metadata = { title: 'Marketplace — Admin' }

export default async function AdminMarketplacePage() {
  const supabase = createAdminClient()

  const { data: rows } = await supabase
    .from('market_materials')
    .select(`
      id, is_visible, is_available, is_featured, sort_order,
      price_display_mode, custom_display_price,
      unavailable_reason, admin_notes,
      material:material_catalog(
        name, slug, category:material_categories(name)
      ),
      market:markets(name),
      pool:market_supply_pool(
        is_preferred, composite_score,
        offering:supplier_offerings(price_per_unit, unit, is_available)
      )
    `)
    .order('sort_order')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Marketplace</h1>
          <p className="text-stone-500 text-sm mt-1">
            Control what customers see and which offerings fulfill orders
          </p>
        </div>
        <Link href="/admin/marketplace/new" className="btn-primary btn-md">
          <Plus size={14} /> Add Material
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800">
                {['Material', 'Market', 'Price', 'Preferred Offering', 'Visibility', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/40">
              {(rows ?? []).map((row: any) => {
                const preferred = row.pool?.find((p: any) => p.is_preferred)
                const offering = preferred?.offering

                const displayPrice =
                  row.price_display_mode === 'custom' ? row.custom_display_price :
                  offering?.price_per_unit ?? null

                return (
                  <tr key={row.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {row.is_featured && <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                        <div>
                          <div className="font-medium text-stone-200">{row.material?.name}</div>
                          <div className="text-xs text-stone-500">{row.material?.category?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-stone-400 text-sm">{row.market?.name}</td>
                    <td className="px-5 py-4">
                      {displayPrice != null ? (
                        <div>
                          <span className="font-semibold text-stone-200">{formatCurrency(displayPrice)}</span>
                          <span className="text-stone-600 text-xs ml-1">/{offering?.unit ?? 'ton'}</span>
                        </div>
                      ) : (
                        <span className="text-stone-600 text-xs">Not set</span>
                      )}
                      <div className="text-[10px] text-stone-600 mt-0.5 capitalize">{row.price_display_mode}</div>
                    </td>
                    <td className="px-5 py-4">
                      {preferred ? (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${offering?.is_available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-stone-400 text-xs">
                            Score: {preferred.composite_score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-red-400 text-xs">No preferred offering</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.is_visible && row.is_available ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <Eye size={12} /> Visible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-stone-500">
                          <EyeOff size={12} /> {!row.is_visible ? 'Hidden' : 'Unavailable'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        href={`/admin/marketplace/${row.id}`}
                        className="p-1.5 rounded text-stone-600 hover:text-amber-400 hover:bg-stone-800 transition-colors block"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
