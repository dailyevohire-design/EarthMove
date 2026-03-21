import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Upload, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react'

export const metadata = { title: 'Import — Admin' }

export default async function AdminImportPage() {
  const supabase = createAdminClient()
  const { data: batches } = await supabase
    .from('import_batches')
    .select('*, market:markets(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const statusIcon = (s: string) => {
    if (s === 'imported') return <CheckCircle2 size={14} className="text-emerald-400" />
    if (s === 'rejected') return <XCircle size={14} className="text-red-400" />
    return <Clock size={14} className="text-amber-400" />
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Import</h1>
          <p className="text-stone-500 text-sm mt-1">Ingest scraped supplier / pricing data</p>
        </div>
        <Link href="/admin/import/new" className="btn-primary btn-md">
          <Upload size={14} /> New Batch
        </Link>
      </div>

      <div className="space-y-3">
        {(!batches || batches.length === 0) && (
          <div className="card p-12 text-center text-stone-600 text-sm">
            No import batches yet. Create one to start ingesting supplier data.
          </div>
        )}
        {(batches ?? []).map((b: any) => (
          <Link
            key={b.id}
            href={`/admin/import/${b.id}`}
            className="card-hover flex items-center gap-4 p-5"
          >
            <div className="p-2.5 bg-stone-800 rounded-lg flex-shrink-0">
              <Upload size={16} className="text-stone-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {statusIcon(b.status)}
                <span className="font-semibold text-stone-200 text-sm">
                  {b.source_name ?? b.source}
                </span>
                <span className="badge-stone text-[10px] capitalize">{b.status.replace('_', ' ')}</span>
              </div>
              <div className="text-stone-500 text-xs">
                {b.total_records} records ·{' '}
                {b.imported_count} imported · {b.rejected_count} rejected
                {b.market?.name && ` · ${b.market.name}`}
              </div>
              <div className="text-stone-700 text-xs mt-0.5">
                {new Date(b.created_at).toLocaleString()}
              </div>
            </div>
            <ArrowRight size={14} className="text-stone-600 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
