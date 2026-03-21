import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { PromotionForm } from '@/components/admin/promotion-form'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function EditPromotionPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: promo }, { data: markets }, { data: catalog }] = await Promise.all([
    supabase.from('promotions').select('*').eq('id', id).single(),
    supabase.from('markets').select('id, name').eq('is_active', true).order('name'),
    supabase.from('material_catalog').select('id, name').eq('is_active', true).order('name'),
  ])

  if (!promo) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/promotions" className="hover:text-stone-300 transition-colors">Promotions</Link>
        <span>/</span>
        <span className="text-stone-400">{promo.title}</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-100 mb-8">Edit Promotion</h1>
      <PromotionForm promotion={promo} markets={markets ?? []} catalog={catalog ?? []} />
    </div>
  )
}
