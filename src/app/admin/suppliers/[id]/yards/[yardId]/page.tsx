import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { OfferingEditor } from '@/components/admin/offering-editor'
import { formatCurrency } from '@/lib/pricing-engine'
import Link from 'next/link'
import { Plus } from 'lucide-react'

interface Props { params: Promise<{ id: string; yardId: string }> }

export default async function YardDetailPage({ params }: Props) {
  const { id: supplierId, yardId } = await params
  const supabase = createAdminClient()

  const { data: yard } = await supabase
    .from('supply_yards')
    .select(`
      *, supplier:suppliers(name),
      offerings:supplier_offerings(
        *, material:material_catalog(name, default_unit, category:material_categories(name))
      )
    `)
    .eq('id', yardId)
    .single()

  if (!yard) notFound()

  const { data: catalog } = await supabase
    .from('material_catalog').select('id, name, default_unit').eq('is_active', true).order('name')

  const offerings = Array.isArray(yard.offerings) ? yard.offerings : []

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-stone-500">
        <Link href="/admin/suppliers" className="hover:text-stone-300 transition-colors">Suppliers</Link>
        <span>/</span>
        <Link href={`/admin/suppliers/${supplierId}`} className="hover:text-stone-300 transition-colors">{(yard.supplier as any)?.name}</Link>
        <span>/</span>
        <span className="text-stone-400">{yard.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">{yard.name}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {[yard.city, yard.state, yard.zip].filter(Boolean).join(', ')}
          </p>
        </div>
        <span className={yard.is_active ? 'badge-green' : 'badge-stone'}>
          {yard.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Offerings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-stone-200">Offerings ({offerings.length})</h2>
        </div>

        <div className="space-y-3">
          {offerings.map((offering: any) => (
            <OfferingEditor key={offering.id} offering={offering} yardId={yardId} catalog={catalog ?? []} />
          ))}

          {/* Add new offering */}
          <OfferingEditor offering={null} yardId={yardId} catalog={catalog ?? []} />
        </div>
      </div>
    </div>
  )
}
