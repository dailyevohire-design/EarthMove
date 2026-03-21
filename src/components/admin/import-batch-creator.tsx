'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createImportBatch } from '@/app/admin/import/new/actions'
import { Loader2, FileJson, FileText } from 'lucide-react'

interface Props { markets: Array<{ id: string; name: string }> }

const EXAMPLE_JSON = `[
  {
    "supplier_name": "ABC Sand & Rock",
    "yard_address": "1234 Industrial Blvd",
    "yard_city": "Dallas",
    "yard_state": "TX",
    "yard_zip": "75201",
    "yard_phone": "214-555-0100",
    "material_name": "Washed Concrete Sand",
    "price": "$18/ton",
    "unit": "ton",
    "min_order": "5 ton minimum",
    "notes": "Call for availability"
  }
]`

export function ImportBatchCreator({ markets }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [marketId, setMarketId] = useState(markets[0]?.id ?? '')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!content.trim()) { setError('Paste data to import.'); return }

    startTransition(async () => {
      const result = await createImportBatch({
        source_name: sourceName || undefined,
        source_url: sourceUrl || undefined,
        market_id: marketId || undefined,
        format,
        raw_content: content,
      })

      if (result.success) {
        router.push(`/admin/import/${result.data.batch_id}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Meta */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Source name</label>
          <input className="input" placeholder="XYZ Quarry DFW" value={sourceName} onChange={e => setSourceName(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Market</label>
          <select className="input" value={marketId} onChange={e => setMarketId(e.target.value)}>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Source URL <span className="text-stone-600">(optional)</span></label>
        <input className="input" placeholder="https://supplier.com/pricing" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
      </div>

      {/* Format selector */}
      <div>
        <label className="input-label">Format</label>
        <div className="flex gap-3">
          {([['json', 'JSON', FileJson], ['csv', 'CSV', FileText]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFormat(val)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                format === val
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="input-label mb-0">Paste data</label>
          <button
            type="button"
            onClick={() => setContent(EXAMPLE_JSON)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Load example
          </button>
        </div>
        <textarea
          className="input font-mono text-xs resize-y"
          rows={12}
          placeholder={format === 'json' ? 'Paste JSON array...' : 'supplier_name,material_name,price,unit,...'}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <p className="text-xs text-stone-600 mt-1.5">
          {format === 'json'
            ? 'Expected: JSON array of objects. Unknown fields are preserved as-is.'
            : 'Expected: CSV with header row. Column names are flexible.'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <button type="submit" disabled={pending} className="btn-primary btn-lg">
        {pending ? <><Loader2 size={15} className="animate-spin" />Creating batch…</> : 'Create Import Batch →'}
      </button>
    </form>
  )
}
