import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Zap, Tag, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/pricing-engine'

export const metadata = { title: 'Promotions — Admin' }

export default async function AdminPromotionsPage() {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: promos } = await supabase
    .from('promotions')
    .select(`
      id, title, promotion_type, discount_value, override_price,
      badge_label, is_deal_of_day, starts_at, ends_at,
      is_active, current_uses, max_uses,
      material:material_catalog(name),
      market:markets(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Promotions</h1>
          <p className="text-stone-500 text-sm mt-1">Deals, discounts, and daily specials</p>
        </div>
        <Link href="/admin/promotions/new" className="btn-primary btn-md">
          <Plus size={14} /> New Promotion
        </Link>
      </div>

      <div className="space-y-3">
        {(!promos || promos.length === 0) && (
          <div className="card p-12 text-center text-stone-600 text-sm">
            No promotions yet. Create one to show deals to customers.
          </div>
        )}
        {(promos ?? []).map((p: any) => {
          const isLive = p.is_active && p.starts_at <= now && (!p.ends_at || p.ends_at > now)

          const discountLabel =
            p.promotion_type === 'percentage' ? `${p.discount_value}% off` :
            p.promotion_type === 'flat_amount' ? `${formatCurrency(p.discount_value)} off` :
            p.promotion_type === 'price_override' ? `→ ${formatCurrency(p.override_price)}` : ''

          return (
            <Link
              key={p.id}
              href={`/admin/promotions/${p.id}`}
              className="card-hover flex items-center gap-4 p-5"
            >
              <div className={`p-2.5 rounded-lg flex-shrink-0 ${p.is_deal_of_day ? 'bg-amber-500/20' : 'bg-stone-800'}`}>
                {p.is_deal_of_day ? <Zap size={16} className="text-amber-400" /> : <Tag size={16} className="text-stone-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-stone-200 text-sm">{p.title}</span>
                  {p.is_deal_of_day && <span className="badge-amber text-[10px]">DEAL OF DAY</span>}
                  <span className={isLive ? 'badge-green text-[10px]' : 'badge-stone text-[10px]'}>
                    {isLive ? 'Live' : 'Inactive'}
                  </span>
                </div>
                <div className="text-stone-500 text-xs">
                  {discountLabel}
                  {p.material?.name && ` · ${p.material.name}`}
                  {p.market?.name && ` · ${p.market.name}`}
                </div>
                <div className="text-stone-700 text-xs mt-0.5">
                  {new Date(p.starts_at).toLocaleDateString()} –{' '}
                  {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : 'No end'}
                  {p.max_uses && ` · ${p.current_uses}/${p.max_uses} uses`}
                </div>
              </div>

              <ArrowRight size={14} className="text-stone-600 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
