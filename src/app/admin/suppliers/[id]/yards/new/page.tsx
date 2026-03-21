import { NewYardForm } from '@/components/admin/new-yard-form'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function NewYardPage({ params }: Props) {
  const { id: supplierId } = await params
  const supabase = createAdminClient()

  const { data: supplier } = await supabase
    .from('suppliers').select('name').eq('id', supplierId).single()
  if (!supplier) notFound()

  const { data: markets } = await supabase
    .from('markets').select('id, name').eq('is_active', true).order('name')

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/suppliers" className="hover:text-stone-300 transition-colors">Suppliers</Link>
        <span>/</span>
        <Link href={`/admin/suppliers/${supplierId}`} className="hover:text-stone-300 transition-colors">{supplier.name}</Link>
        <span>/</span>
        <span className="text-stone-400">New Yard</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-100 mb-8">Add Supply Yard</h1>
      <NewYardForm supplierId={supplierId} markets={markets ?? []} />
    </div>
  )
}
