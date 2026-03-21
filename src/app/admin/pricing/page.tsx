import { createAdminClient } from '@/lib/supabase/server'
import { PricingRulesEditor } from '@/components/admin/pricing-rules-editor'

export const metadata = { title: 'Pricing Rules — Admin' }

export default async function AdminPricingPage() {
  const supabase = createAdminClient()

  const [{ data: rules }, { data: markets }] = await Promise.all([
    supabase
      .from('pricing_rules')
      .select('*, market:markets(name)')
      .eq('is_active', true)
      .order('rule_type'),
    supabase.from('markets').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-100">Pricing Rules</h1>
        <p className="text-stone-500 text-sm mt-1">
          Platform fee and delivery tier configuration per market
        </p>
      </div>
      <PricingRulesEditor rules={rules ?? []} markets={markets ?? []} />
    </div>
  )
}
