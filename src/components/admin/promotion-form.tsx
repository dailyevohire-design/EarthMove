'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePromotion } from '@/app/admin/promotions/actions'
import { Loader2 } from 'lucide-react'

interface Props {
  promotion?: any
  markets: Array<{ id: string; name: string }>
  catalog: Array<{ id: string; name: string }>
}

export function PromotionForm({ promotion, markets, catalog }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    title:           promotion?.title ?? '',
    description:     promotion?.description ?? '',
    promotion_type:  promotion?.promotion_type ?? 'percentage',
    discount_value:  promotion?.discount_value?.toString() ?? '',
    override_price:  promotion?.override_price?.toString() ?? '',
    badge_label:     promotion?.badge_label ?? '',
    is_deal_of_day:  promotion?.is_deal_of_day ?? false,
    starts_at:       promotion?.starts_at
      ? new Date(promotion.starts_at).toISOString().slice(0,16)
      : new Date().toISOString().slice(0,16),
    ends_at:         promotion?.ends_at
      ? new Date(promotion.ends_at).toISOString().slice(0,16)
      : '',
    max_uses:        promotion?.max_uses?.toString() ?? '',
    min_order_amount: promotion?.min_order_amount?.toString() ?? '',
    is_active:       promotion?.is_active ?? true,
    market_id:       promotion?.market_id ?? '',
    material_catalog_id: promotion?.material_catalog_id ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await savePromotion(promotion?.id ?? null, {
        ...form,
        discount_value:   form.discount_value ? parseFloat(form.discount_value) : null,
        override_price:   form.override_price ? parseFloat(form.override_price) : null,
        max_uses:         form.max_uses ? parseInt(form.max_uses) : null,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        starts_at:        new Date(form.starts_at).toISOString(),
        ends_at:          form.ends_at ? new Date(form.ends_at).toISOString() : null,
        market_id:        form.market_id || null,
        material_catalog_id: form.material_catalog_id || null,
      })

      if (result.success) {
        router.push('/admin/promotions')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <div>
        <label className="input-label">Title *</label>
        <input className="input" required value={form.title} onChange={set('title')} placeholder="Summer Fill Dirt Deal" />
      </div>

      <div>
        <label className="input-label">Description</label>
        <textarea className="input resize-none" rows={2} value={form.description} onChange={set('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Promotion type *</label>
          <select className="input" value={form.promotion_type} onChange={set('promotion_type')}>
            <option value="percentage">Percentage off</option>
            <option value="flat_amount">Flat amount off</option>
            <option value="price_override">Override price</option>
          </select>
        </div>
        <div>
          {form.promotion_type === 'price_override' ? (
            <>
              <label className="input-label">Override price ($)</label>
              <input type="number" step="0.01" min="0.01" className="input" value={form.override_price} onChange={set('override_price')} />
            </>
          ) : (
            <>
              <label className="input-label">{form.promotion_type === 'percentage' ? 'Discount %' : 'Discount ($)'}</label>
              <input type="number" step="0.01" min="0.01" className="input" value={form.discount_value} onChange={set('discount_value')} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Market scope</label>
          <select className="input" value={form.market_id} onChange={set('market_id')}>
            <option value="">All markets</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Material scope</label>
          <select className="input" value={form.material_catalog_id} onChange={set('material_catalog_id')}>
            <option value="">All materials</option>
            {catalog.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="input-label">Badge label</label>
        <input className="input" value={form.badge_label} onChange={set('badge_label')} placeholder="DEAL OF THE DAY" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Starts at *</label>
          <input type="datetime-local" required className="input" value={form.starts_at} onChange={set('starts_at')} />
        </div>
        <div>
          <label className="input-label">Ends at</label>
          <input type="datetime-local" className="input" value={form.ends_at} onChange={set('ends_at')} />
        </div>
        <div>
          <label className="input-label">Max uses</label>
          <input type="number" min="1" className="input" value={form.max_uses} onChange={set('max_uses')} placeholder="Unlimited" />
        </div>
        <div>
          <label className="input-label">Min order ($)</label>
          <input type="number" step="0.01" min="0" className="input" value={form.min_order_amount} onChange={set('min_order_amount')} placeholder="None" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_deal_of_day} onChange={set('is_deal_of_day')} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-stone-300">Deal of the day</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-sm text-stone-300">Active</span>
        </label>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary btn-md">
          {pending ? <><Loader2 size={14} className="animate-spin" />{promotion ? 'Saving…' : 'Creating…'}</> : promotion ? 'Save Changes' : 'Create Promotion'}
        </button>
        <button type="button" onClick={() => router.push('/admin/promotions')} className="btn-secondary btn-md">Cancel</button>
      </div>
    </form>
  )
}
