'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createYard } from '@/app/admin/suppliers/[id]/yards/new/actions'
import { Loader2 } from 'lucide-react'

interface Props {
  supplierId: string
  markets: Array<{ id: string; name: string }>
}

export function NewYardForm({ supplierId, markets }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '', address_line_1: '', city: '', state: 'TX', zip: '',
    phone: '', market_id: markets[0]?.id ?? '',
    delivery_radius_miles: '60', delivery_enabled: true,
    pickup_enabled: false, internal_notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createYard(supplierId, {
        ...form,
        delivery_radius_miles: parseFloat(form.delivery_radius_miles) || 60,
      })
      if (result.success) {
        router.push(`/admin/suppliers/${supplierId}/yards/${result.data.yard_id}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="input-label">Yard name *</label>
          <input className="input" required placeholder="Main Yard" value={form.name} onChange={set('name')} />
        </div>
        <div className="col-span-2">
          <label className="input-label">Market *</label>
          <select className="input" value={form.market_id} onChange={set('market_id')}>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="input-label">Street address</label>
          <input className="input" value={form.address_line_1} onChange={set('address_line_1')} placeholder="1234 Industrial Blvd" />
        </div>
        <div>
          <label className="input-label">City</label>
          <input className="input" value={form.city} onChange={set('city')} placeholder="Dallas" />
        </div>
        <div>
          <label className="input-label">State</label>
          <input className="input" value={form.state} onChange={set('state')} placeholder="TX" maxLength={2} />
        </div>
        <div>
          <label className="input-label">ZIP</label>
          <input className="input" value={form.zip} onChange={set('zip')} placeholder="75201" />
        </div>
        <div>
          <label className="input-label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="input-label">Delivery radius (miles)</label>
          <input type="number" step="1" min="1" className="input" value={form.delivery_radius_miles} onChange={set('delivery_radius_miles')} />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.delivery_enabled} onChange={set('delivery_enabled')} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-stone-300">Delivery enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.pickup_enabled} onChange={set('pickup_enabled')} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-stone-300">Pickup enabled</span>
        </label>
      </div>

      <div>
        <label className="input-label">Internal notes</label>
        <textarea className="input resize-none" rows={2} value={form.internal_notes} onChange={set('internal_notes')} />
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary btn-md">
          {pending ? <><Loader2 size={14} className="animate-spin" />Creating…</> : 'Create Yard'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary btn-md">Cancel</button>
      </div>
    </form>
  )
}
