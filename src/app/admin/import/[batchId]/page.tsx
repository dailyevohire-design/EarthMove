import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { ImportReviewTable } from '@/components/admin/import-review-table'
import Link from 'next/link'

interface Props { params: Promise<{ batchId: string }> }

export default async function ImportBatchPage({ params }: Props) {
  const { batchId } = await params
  const supabase = createAdminClient()

  const { data: batch } = await supabase
    .from('import_batches')
    .select('*, market:markets(name)')
    .eq('id', batchId)
    .single()

  if (!batch) notFound()

  const { data: records } = await supabase
    .from('import_records')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at')

  // Fetch lookup data for review selectors
  const [{ data: suppliers }, { data: catalog }] = await Promise.all([
    supabase.from('suppliers').select('id, name').eq('status', 'active').order('name'),
    supabase.from('material_catalog').select('id, name, slug').eq('is_active', true).order('name'),
  ])

  const pending   = (records ?? []).filter((r: any) => r.status === 'pending_review').length
  const imported  = (records ?? []).filter((r: any) => r.status === 'imported').length
  const rejected  = (records ?? []).filter((r: any) => r.status === 'rejected').length

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6 text-sm text-stone-500">
        <Link href="/admin/import" className="hover:text-stone-300 transition-colors">Import</Link>
        <span>/</span>
        <span className="text-stone-400">{batch.source_name ?? batch.source}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">{batch.source_name ?? 'Import Batch'}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {batch.market?.name} · {new Date(batch.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="badge-amber">{pending} pending</span>
          <span className="badge-green">{imported} imported</span>
          <span className="badge-red">{rejected} rejected</span>
        </div>
      </div>

      <ImportReviewTable
        records={records ?? []}
        suppliers={suppliers ?? []}
        catalog={catalog ?? []}
      />
    </div>
  )
}
