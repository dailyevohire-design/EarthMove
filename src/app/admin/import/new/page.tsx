import { ImportBatchCreator } from '@/components/admin/import-batch-creator'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = { title: 'New Import Batch — Admin' }

export default async function NewImportPage() {
  const supabase = createAdminClient()
  const { data: markets } = await supabase
    .from('markets').select('id, name').eq('is_active', true).order('name')

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/import" className="hover:text-stone-300 transition-colors">Import</Link>
        <span>/</span>
        <span className="text-stone-400">New Batch</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-100 mb-2">New Import Batch</h1>
      <p className="text-stone-500 text-sm mb-8">
        Paste scraped supplier data as JSON or CSV. Each record becomes a reviewable import entry.
      </p>
      <ImportBatchCreator markets={markets ?? []} />
    </div>
  )
}
