'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSupplier } from '@/app/admin/suppliers/[id]/actions'
import type { Supplier } from '@/types'
import { Loader2 } from 'lucide-react'

export function SupplierEditor({ supplier }: { supplier: Supplier }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name:                  supplier.name,
    status:                supplier.status,
    primary_contact_name:  supplier.primary_contact_name ?? '',
    primary_contact_phone: supplier.primary_contact_phone ?? '',
    primary_contact_email: supplier.primary_contact_email ?? '',
    website:               supplier.website ?? '',
    portal_enabled:        supplier.portal_enabled,
    internal_notes:        supplier.internal_notes ?? '',
  })
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSave = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveSupplier(supplier.id, form)
      setFeedback(result.success
        ? { ok: true, msg: 'Saved.' }
        : { ok: false, msg: result.error })
      if (result.success) router.refresh()
    })
  }

  return (
    <div className="card p-6 space-y-5">
      <h3 className="font-semibold text-stone-200">Supplier Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="input-label">Company name *</label>
          <input className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div>
          <label className="input-label">Website</label>
          <input className="input" type="url" placeholder="https://" value={form.website} onChange={set('website')} />
        </div>
        <div>
          <label className="input-label">Contact name</label>
          <input className="input" value={form.primary_contact_name} onChange={set('primary_contact_name')} />
        </div>
        <div>
          <label className="input-label">Contact phone</label>
          <input className="input" type="tel" value={form.primary_contact_phone} onChange={set('primary_contact_phone')} />
        </div>
        <div className="col-span-2">
          <label className="input-label">Contact email</label>
          <input className="input" type="email" value={form.primary_contact_email} onChange={set('primary_contact_email')} />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.portal_enabled} onChange={set('portal_enabled')} className="w-4 h-4 rounded accent-amber-500" />
        <div>
          <div className="text-sm text-stone-300">Supplier portal enabled</div>
          <div className="text-xs text-stone-500">Allows supplier users to log in and view their data</div>
        </div>
      </label>

      <div>
        <label className="input-label">Internal notes</label>
        <textarea className="input resize-none" rows={3} value={form.internal_notes} onChange={set('internal_notes')} />
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
