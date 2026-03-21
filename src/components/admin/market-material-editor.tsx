'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateMarketMaterial } from '@/app/admin/marketplace/[id]/actions'
import { formatCurrency } from '@/lib/pricing-engine'
import type { MarketMaterial, SupplierOffering } from '@/types'
import { Loader2, Eye, EyeOff, Star } from 'lucide-react'

interface Props {
  mm: MarketMaterial & { material?: any; market?: any }
  eligibleOfferings: (SupplierOffering & { supply_yard?: any })[]
}

export function MarketMaterialEditor({ mm, eligibleOfferings }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    is_visible:           mm.is_visible,
    is_available:         mm.is_available,
    is_featured:          mm.is_featured,
    price_display_mode:   mm.price_display_mode,
    custom_display_price: mm.custom_display_price?.toString() ?? '',
    display_name:         mm.display_name ?? '',
    display_description:  mm.display_description ?? '',
    unavailable_reason:   mm.unavailable_reason ?? '',
    admin_notes:          mm.admin_notes ?? '',
    preferred_offering_id: (mm.pool as any)?.find((p: any) => p.is_preferred)?.offering?.id ?? '',
    fallback_offering_id:  (mm.pool as any)?.find((p: any) => p.is_fallback)?.offering?.id ?? '',
  })
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSave = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await updateMarketMaterial(mm.id, {
        ...form,
        custom_display_price: form.custom_display_price ? parseFloat(form.custom_display_price) : null,
        preferred_offering_id: form.preferred_offering_id || null,
        fallback_offering_id: form.fallback_offering_id || null,
      })
      if (result.success) {
        setFeedback({ ok: true, msg: 'Saved.' })
        router.refresh()
      } else {
        setFeedback({ ok: false, msg: result.error })
      }
    })
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Visibility toggles */}
      <div>
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Visibility</h3>
        <div className="space-y-2">
          {[
            { key: 'is_visible', label: 'Visible in marketplace', icon: form.is_visible ? Eye : EyeOff },
            { key: 'is_available', label: 'Available (can be ordered)' },
            { key: 'is_featured', label: 'Featured (homepage + top of browse)', icon: Star },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] as boolean}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-stone-300 group-hover:text-stone-100 transition-colors">{label}</span>
            </label>
          ))}
        </div>
        {!form.is_available && (
          <div className="mt-3">
            <label className="input-label text-xs">Unavailable reason (shown to customers)</label>
            <input className="input text-sm" placeholder="Temporarily out of stock" value={form.unavailable_reason} onChange={set('unavailable_reason')} />
          </div>
        )}
      </div>

      {/* Display */}
      <div>
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Display</h3>
        <div className="space-y-3">
          <div>
            <label className="input-label text-xs">Display name <span className="text-stone-600">(overrides catalog name)</span></label>
            <input className="input text-sm" placeholder={mm.material?.name} value={form.display_name} onChange={set('display_name')} />
          </div>
          <div>
            <label className="input-label text-xs">Display description</label>
            <textarea className="input text-sm resize-none" rows={2} value={form.display_description} onChange={set('display_description')} />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Price Display</h3>
        <div className="space-y-3">
          <div>
            <label className="input-label text-xs">Mode</label>
            <select className="input text-sm" value={form.price_display_mode} onChange={set('price_display_mode')}>
              <option value="exact">Exact — show offering price directly</option>
              <option value="custom">Custom — show manually set price</option>
            </select>
          </div>
          {form.price_display_mode === 'custom' && (
            <div>
              <label className="input-label text-xs">Custom display price ($/unit)</label>
              <input type="number" step="0.01" min="0" className="input text-sm" placeholder="12.00" value={form.custom_display_price} onChange={set('custom_display_price')} />
            </div>
          )}
        </div>
      </div>

      {/* Fulfillment source */}
      <div>
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Fulfillment Source</h3>
        <div className="space-y-3">
          <div>
            <label className="input-label text-xs">Preferred offering <span className="text-stone-600">(used for all orders)</span></label>
            <select className="input text-sm" value={form.preferred_offering_id} onChange={set('preferred_offering_id')}>
              <option value="">— Select preferred offering —</option>
              {eligibleOfferings.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.supply_yard?.supplier?.name} / {o.supply_yard?.name} — {o.price_per_unit ? formatCurrency(o.price_per_unit) : '?'}/{o.unit}
                  {!o.is_available ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label text-xs">Fallback offering <span className="text-stone-600">(if preferred unavailable)</span></label>
            <select className="input text-sm" value={form.fallback_offering_id} onChange={set('fallback_offering_id')}>
              <option value="">— No fallback —</option>
              {eligibleOfferings
                .filter((o: any) => o.id !== form.preferred_offering_id)
                .map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.supply_yard?.supplier?.name} / {o.supply_yard?.name} — {o.price_per_unit ? formatCurrency(o.price_per_unit) : '?'}/{o.unit}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Admin notes */}
      <div>
        <label className="input-label text-xs">Admin notes (internal)</label>
        <textarea className="input text-sm resize-none" rows={2} value={form.admin_notes} onChange={set('admin_notes')} />
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-sm border ${feedback.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {feedback.msg}
        </div>
      )}

      <button onClick={handleSave} disabled={pending} className="btn-primary btn-md">
        {pending ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Save Changes'}
      </button>
    </div>
  )
}
