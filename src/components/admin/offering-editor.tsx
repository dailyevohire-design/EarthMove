'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveOffering } from '@/app/admin/suppliers/[id]/yards/[yardId]/actions'
import { Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react'

interface Props {
  offering: any | null
  yardId: string
  catalog: Array<{ id: string; name: string; default_unit: string }>
}

export function OfferingEditor({ offering, yardId, catalog }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(!offering) // new offerings start expanded
  const [form, setForm] = useState({
    material_catalog_id:    offering?.material_catalog_id ?? '',
    price_per_unit:         offering?.price_per_unit?.toString() ?? '',
    unit:                   offering?.unit ?? 'ton',
    minimum_order_quantity: offering?.minimum_order_quantity?.toString() ?? '1',
    typical_load_size:      offering?.typical_load_size?.toString() ?? '',
    load_size_label:        offering?.load_size_label ?? '',
    delivery_fee_base:      offering?.delivery_fee_base?.toString() ?? '',
    delivery_fee_per_mile:  offering?.delivery_fee_per_mile?.toString() ?? '',
    max_delivery_miles:     offering?.max_delivery_miles?.toString() ?? '60',
    availability_confidence: offering?.availability_confidence?.toString() ?? '75',
    is_available:           offering?.is_available ?? true,
    is_public:              offering?.is_public ?? false,
    available_for_delivery: offering?.available_for_delivery ?? true,
    internal_notes:         offering?.internal_notes ?? '',
  })
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSave = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveOffering(offering?.id ?? null, yardId, {
        ...form,
        price_per_unit:          parseFloat(form.price_per_unit) || 0,
        minimum_order_quantity:  parseFloat(form.minimum_order_quantity) || 1,
        typical_load_size:       form.typical_load_size ? parseFloat(form.typical_load_size) : null,
        delivery_fee_base:       form.delivery_fee_base ? parseFloat(form.delivery_fee_base) : null,
        delivery_fee_per_mile:   form.delivery_fee_per_mile ? parseFloat(form.delivery_fee_per_mile) : null,
        max_delivery_miles:      form.max_delivery_miles ? parseFloat(form.max_delivery_miles) : null,
        availability_confidence: parseInt(form.availability_confidence) || 75,
      })
      setFeedback(result.success
        ? { ok: true, msg: offering ? 'Saved.' : 'Offering added.' }
        : { ok: false, msg: result.error })
      if (result.success) { router.refresh(); if (!offering) setOpen(false) }
    })
  }

  if (!offering && !open) {
    return (
      <button onClick={() => setOpen(true)} className="card flex items-center justify-center gap-2 p-4 w-full text-stone-500 hover:text-amber-400 hover:border-stone-600 transition-colors border-dashed">
        <Plus size={14} /> Add offering
      </button>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-stone-800/40 transition-colors ${offering ? '' : 'bg-stone-800/30'}`}
        onClick={() => offering && setOpen(o => !o)}
      >
        <div className="flex-1">
          {offering ? (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${offering.is_available ? 'bg-emerald-500' : 'bg-stone-600'}`} />
              <span className="font-medium text-stone-200 text-sm">{offering.material?.name}</span>
              <span className="text-stone-500 text-xs">{offering.price_per_unit != null ? `$${offering.price_per_unit}/${offering.unit}` : ''}</span>
              {offering.is_public && <span className="badge-blue text-[10px]">Public</span>}
            </div>
          ) : (
            <span className="font-medium text-amber-400 text-sm">New Offering</span>
          )}
        </div>
        {offering && (open ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />)}
      </div>

      {open && (
        <div className="border-t border-stone-800 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="input-label text-xs">Material *</label>
              <select className="input text-sm" value={form.material_catalog_id} onChange={set('material_catalog_id')}>
                <option value="">— Select material —</option>
                {catalog.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label text-xs">Price per unit ($) *</label>
              <input type="number" step="0.01" min="0.01" className="input text-sm" value={form.price_per_unit} onChange={set('price_per_unit')} />
            </div>
            <div>
              <label className="input-label text-xs">Unit</label>
              <select className="input text-sm" value={form.unit} onChange={set('unit')}>
                <option value="ton">Ton</option>
                <option value="cubic_yard">Cubic Yard</option>
                <option value="load">Load</option>
                <option value="each">Each</option>
              </select>
            </div>
            <div>
              <label className="input-label text-xs">Min order qty</label>
              <input type="number" step="1" min="1" className="input text-sm" value={form.minimum_order_quantity} onChange={set('minimum_order_quantity')} />
            </div>
            <div>
              <label className="input-label text-xs">Typical load size</label>
              <input type="number" step="1" className="input text-sm" placeholder="14" value={form.typical_load_size} onChange={set('typical_load_size')} />
            </div>
            <div>
              <label className="input-label text-xs">Delivery base fee ($)</label>
              <input type="number" step="0.01" min="0" className="input text-sm" placeholder="95.00" value={form.delivery_fee_base} onChange={set('delivery_fee_base')} />
            </div>
            <div>
              <label className="input-label text-xs">Per mile ($)</label>
              <input type="number" step="0.01" min="0" className="input text-sm" placeholder="3.50" value={form.delivery_fee_per_mile} onChange={set('delivery_fee_per_mile')} />
            </div>
            <div>
              <label className="input-label text-xs">Availability confidence</label>
              <input type="number" min="0" max="100" className="input text-sm" value={form.availability_confidence} onChange={set('availability_confidence')} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'is_available', label: 'Available' },
              { key: 'available_for_delivery', label: 'Delivery enabled' },
              { key: 'is_public', label: 'Public (eligible for marketplace pool)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={set(key as keyof typeof form)} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm text-stone-300">{label}</span>
              </label>
            ))}
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg text-sm border ${feedback.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {feedback.msg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={pending} className="btn-primary btn-sm">
              {pending ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save Offering'}
            </button>
            {!offering && (
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
