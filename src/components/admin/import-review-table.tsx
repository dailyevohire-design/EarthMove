'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveImportRecord, rejectImportRecord } from '@/app/admin/import/new/actions'
import type { ImportRecord, MaterialUnit } from '@/types'
import { Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Props {
  records: ImportRecord[]
  suppliers: Array<{ id: string; name: string }>
  catalog: Array<{ id: string; name: string; slug: string }>
}

type RecordState = {
  supplier_id: string
  yard_id: string
  catalog_id: string
  parsed_price: string
  parsed_unit: MaterialUnit
  parsed_min: string
  admin_notes: string
  reject_reason: string
  expanded: boolean
}

export function ImportReviewTable({ records, suppliers, catalog }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [states, setStates] = useState<Record<string, RecordState>>(() =>
    Object.fromEntries(
      records.map(r => [r.id, {
        supplier_id:   r.resolved_supplier_id ?? '',
        yard_id:       r.resolved_yard_id ?? '',
        catalog_id:    r.resolved_catalog_id ?? '',
        parsed_price:  r.parsed_price?.toString() ?? parseRawPrice(r.raw_price),
        parsed_unit:   (r.parsed_unit ?? 'ton') as MaterialUnit,
        parsed_min:    r.parsed_min_quantity?.toString() ?? '1',
        admin_notes:   r.admin_notes ?? '',
        reject_reason: '',
        expanded:      r.status === 'pending_review',
      }])
    )
  )

  // Yards per supplier (fetched lazily via state)
  const [yardsBySupplier, setYardsBySupplier] = useState<Record<string, Array<{ id: string; name: string; city: string | null }>>>({})
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const update = (id: string, patch: Partial<RecordState>) =>
    setStates(s => ({ ...s, [id]: { ...s[id], ...patch } }))

  const fetchYards = async (supplierId: string) => {
    if (yardsBySupplier[supplierId]) return
    const res = await fetch(`/api/admin/yards?supplier_id=${supplierId}`)
    const data = await res.json()
    setYardsBySupplier(y => ({ ...y, [supplierId]: data.yards ?? [] }))
  }

  const handleApprove = (record: ImportRecord) => {
    const s = states[record.id]
    if (!s.supplier_id || !s.yard_id || !s.catalog_id || !s.parsed_price) {
      setFeedback(f => ({ ...f, [record.id]: { ok: false, msg: 'Fill in all required fields.' } }))
      return
    }
    startTransition(async () => {
      const result = await approveImportRecord({
        record_id:    record.id,
        supplier_id:  s.supplier_id,
        yard_id:      s.yard_id,
        catalog_id:   s.catalog_id,
        parsed_price: parseFloat(s.parsed_price),
        parsed_unit:  s.parsed_unit,
        parsed_min:   parseFloat(s.parsed_min) || 1,
        admin_notes:  s.admin_notes || undefined,
      })
      setFeedback(f => ({
        ...f,
        [record.id]: result.success
          ? { ok: true, msg: 'Imported.' }
          : { ok: false, msg: result.error }
      }))
      if (result.success) {
        update(record.id, { expanded: false })
        router.refresh()
      }
    })
  }

  const handleReject = (record: ImportRecord) => {
    const s = states[record.id]
    if (!s.reject_reason.trim()) {
      setFeedback(f => ({ ...f, [record.id]: { ok: false, msg: 'Enter a rejection reason.' } }))
      return
    }
    startTransition(async () => {
      const result = await rejectImportRecord(record.id, s.reject_reason)
      setFeedback(f => ({
        ...f,
        [record.id]: result.success
          ? { ok: true, msg: 'Rejected.' }
          : { ok: false, msg: result.error }
      }))
      if (result.success) {
        update(record.id, { expanded: false })
        router.refresh()
      }
    })
  }

  const statusBadge = (status: string) => {
    if (status === 'imported') return <span className="badge-green">Imported</span>
    if (status === 'rejected') return <span className="badge-red">Rejected</span>
    return <span className="badge-amber">Pending</span>
  }

  return (
    <div className="space-y-2">
      {records.map(record => {
        const s = states[record.id]
        const fb = feedback[record.id]
        const yards = yardsBySupplier[s?.supplier_id] ?? []
        const isDone = record.status !== 'pending_review'

        return (
          <div key={record.id} className={`card overflow-hidden ${isDone ? 'opacity-60' : ''}`}>
            {/* Header row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-stone-800/40 transition-colors"
              onClick={() => update(record.id, { expanded: !s.expanded })}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {statusBadge(record.status)}
                  <span className="font-medium text-stone-200 text-sm truncate">
                    {record.raw_supplier_name ?? '—'} · {record.raw_material_name ?? '—'}
                  </span>
                </div>
                <div className="text-stone-500 text-xs">
                  {[record.raw_yard_city, record.raw_yard_state].filter(Boolean).join(', ')}
                  {record.raw_price && ` · ${record.raw_price}`}
                  {record.raw_unit && ` / ${record.raw_unit}`}
                </div>
              </div>
              {s.expanded ? <ChevronUp size={15} className="text-stone-500 flex-shrink-0" /> : <ChevronDown size={15} className="text-stone-500 flex-shrink-0" />}
            </div>

            {/* Expanded review form */}
            {s.expanded && (
              <div className="border-t border-stone-800 p-5 space-y-5 bg-stone-900/40">
                {/* Raw data */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Raw Data</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Supplier', record.raw_supplier_name],
                      ['Address', record.raw_yard_address],
                      ['City', record.raw_yard_city],
                      ['State / ZIP', [record.raw_yard_state, record.raw_yard_zip].filter(Boolean).join(' ')],
                      ['Phone', record.raw_yard_phone],
                      ['Material', record.raw_material_name],
                      ['Price', record.raw_price],
                      ['Unit', record.raw_unit],
                      ['Min Order', record.raw_min_order],
                      ['Notes', record.raw_notes],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label as string} className="flex gap-2">
                        <span className="text-stone-600 w-24 flex-shrink-0">{label as string}</span>
                        <span className="text-stone-300">{val as string}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolution fields */}
                {!isDone && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Resolution</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="input-label text-xs">Supplier *</label>
                          <select
                            className="input text-sm"
                            value={s.supplier_id}
                            onChange={async e => {
                              update(record.id, { supplier_id: e.target.value, yard_id: '' })
                              if (e.target.value) await fetchYards(e.target.value)
                            }}
                          >
                            <option value="">— Select supplier —</option>
                            {suppliers.map(sup => (
                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="input-label text-xs">Supply Yard *</label>
                          <select
                            className="input text-sm"
                            value={s.yard_id}
                            onChange={e => update(record.id, { yard_id: e.target.value })}
                            disabled={!s.supplier_id}
                          >
                            <option value="">— Select yard —</option>
                            {yards.map(y => (
                              <option key={y.id} value={y.id}>{y.name} {y.city ? `(${y.city})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="input-label text-xs">Canonical Material *</label>
                          <select
                            className="input text-sm"
                            value={s.catalog_id}
                            onChange={e => update(record.id, { catalog_id: e.target.value })}
                          >
                            <option value="">— Map to material —</option>
                            {catalog.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="input-label text-xs">Price per unit ($) *</label>
                          <input
                            type="number" step="0.01" min="0.01" className="input text-sm"
                            value={s.parsed_price}
                            onChange={e => update(record.id, { parsed_price: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="input-label text-xs">Unit *</label>
                          <select
                            className="input text-sm"
                            value={s.parsed_unit}
                            onChange={e => update(record.id, { parsed_unit: e.target.value as MaterialUnit })}
                          >
                            <option value="ton">Ton</option>
                            <option value="cubic_yard">Cubic Yard</option>
                            <option value="load">Load</option>
                            <option value="each">Each</option>
                          </select>
                        </div>
                        <div>
                          <label className="input-label text-xs">Min order quantity</label>
                          <input
                            type="number" step="1" min="1" className="input text-sm"
                            value={s.parsed_min}
                            onChange={e => update(record.id, { parsed_min: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="input-label text-xs">Admin notes</label>
                          <input
                            className="input text-sm"
                            placeholder="Optional notes"
                            value={s.admin_notes}
                            onChange={e => update(record.id, { admin_notes: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-3 pt-2 border-t border-stone-800">
                      <div className="flex-1">
                        <label className="input-label text-xs text-red-400">Reject reason</label>
                        <input
                          className="input text-sm"
                          placeholder="Duplicate, bad data…"
                          value={s.reject_reason}
                          onChange={e => update(record.id, { reject_reason: e.target.value })}
                        />
                      </div>
                      <button
                        onClick={() => handleReject(record)}
                        disabled={pending}
                        className="btn-danger btn-sm flex-shrink-0"
                      >
                        {pending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(record)}
                        disabled={pending}
                        className="btn-primary btn-sm flex-shrink-0"
                      >
                        {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Approve
                      </button>
                    </div>
                  </>
                )}

                {/* Feedback */}
                {fb && (
                  <div className={`p-3 rounded-lg text-sm border ${fb.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {fb.msg}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Best-effort parse of raw price strings like "$18/ton", "18.00", "18 per ton"
function parseRawPrice(raw: string | null): string {
  if (!raw) return ''
  const match = raw.match(/[\d]+(?:\.\d+)?/)
  return match ? match[0] : ''
}
