import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { MarketMaterialEditor } from '@/components/admin/market-material-editor'
import { formatCurrency } from '@/lib/pricing-engine'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function AdminMarketMaterialPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: mm } = await supabase
    .from('market_materials')
    .select(`
      *,
      material:material_catalog(name, slug, default_unit, category:material_categories(name)),
      market:markets(id, name),
      pool:market_supply_pool(
        id, is_preferred, is_fallback, is_active, composite_score,
        price_score, distance_score, reliability_score, availability_score,
        admin_override_score, admin_notes,
        offering:supplier_offerings(
          id, price_per_unit, unit, is_available, availability_confidence,
          delivery_fee_base, supplier_material_name,
          supply_yard:supply_yards(
            name, city, state,
            supplier:suppliers(name)
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!mm) notFound()

  // Eligible offerings for this market + material (for preferred/fallback selector)
  const { data: eligible } = await supabase
    .from('supplier_offerings')
    .select(`
      id, price_per_unit, unit, is_available, availability_confidence,
      delivery_fee_base, supplier_material_name,
      supply_yard:supply_yards(
        id, name, city, state, is_active,
        supplier:suppliers(id, name, status)
      )
    `)
    .eq('material_catalog_id', mm.material_catalog_id)
    .eq('is_public', true)

  // Filter to same market only
  const sameMarket = (eligible ?? []).filter(
    (o: any) => o.supply_yard?.supplier?.status === 'active' && o.supply_yard?.is_active
  )

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/marketplace" className="hover:text-stone-300 transition-colors">Marketplace</Link>
        <span>/</span>
        <span className="text-stone-400">{mm.material?.name}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">{mm.material?.name}</h1>
        <p className="text-stone-500 text-sm mt-1">
          {mm.market?.name} · {mm.material?.category?.name}
        </p>
      </div>

      {/* Pool health */}
      {(mm.pool as any[])?.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Supply Pool</h3>
          <div className="space-y-3">
            {(mm.pool as any[]).map((entry: any) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-stone-800/50 rounded-lg">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.offering?.is_available ? 'bg-emerald-500' : 'bg-stone-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-stone-200 text-sm font-medium truncate">
                    {entry.offering?.supply_yard?.supplier?.name} — {entry.offering?.supply_yard?.name}
                  </div>
                  <div className="text-stone-500 text-xs">
                    {entry.offering?.price_per_unit ? formatCurrency(entry.offering.price_per_unit) : '—'} / {entry.offering?.unit}
                    {' · '}conf. {entry.offering?.availability_confidence}%
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-stone-300 text-xs font-mono">Score: {entry.composite_score}</div>
                  <div className="flex gap-1">
                    {entry.is_preferred && <span className="badge-amber text-[10px]">PREFERRED</span>}
                    {entry.is_fallback && <span className="badge-stone text-[10px]">FALLBACK</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <MarketMaterialEditor mm={mm as any} eligibleOfferings={sameMarket as any[]} />
    </div>
  )
}
