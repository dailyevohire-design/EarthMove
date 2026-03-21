import { createAdminClient } from '@/lib/supabase/server'
import { PromotionForm } from '@/components/admin/promotion-form'
import Link from 'next/link'

export const metadata = { title: 'New Promotion — Admin' }

export default async function NewPromotionPage() {
  const supabase = createAdminClient()
  const [{ data: markets }, { data: catalog }] = await Promise.all([
    supabase.from('markets').select('id, name').eq('is_active', true).order('name'),
    supabase.from('material_catalog').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/promotions" className="hover:text-stone-300 transition-colors">Promotions</Link>
        <span>/</span>
        <span className="text-stone-400">New</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-100 mb-8">Create Promotion</h1>
      <PromotionForm markets={markets ?? []} catalog={catalog ?? []} />
    </div>
  )
}
