'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupplier } from '@/app/admin/suppliers/[id]/actions'
import { Loader2 } from 'lucide-react'

export function NewSupplierForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '', status: 'pending', primary_contact_name: '',
    primary_contact_phone: '', primary_contact_email: '',
    website: '', portal_enabled: false, internal_notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createSupplier(form)
      if (result.success) {
        router.push(`/admin/suppliers/${result.data.supplier_id}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <label className="input-label">Company name *</label>
        <input className="input" required value={form.name} onChange={set('name')} placeholder="ABC Sand & Rock" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Contact name</label>
          <input className="input" value={form.primary_contact_name} onChange={set('primary_contact_name')} />
        </div>
        <div>
          <label className="input-label">Contact phone</label>
          <input className="input" type="tel" value={form.primary_contact_phone} onChange={set('primary_contact_phone')} />
        </div>
        <div>
          <label className="input-label">Contact email</label>
          <input className="input" type="email" value={form.primary_contact_email} onChange={set('primary_contact_email')} />
        </div>
        <div>
          <label className="input-label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      <div>
        <label className="input-label">Internal notes</label>
        <textarea className="input resize-none" rows={2} value={form.internal_notes} onChange={set('internal_notes')} />
      </div>
      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary btn-md">
          {pending ? <><Loader2 size={14} className="animate-spin" />Creating…</> : 'Create Supplier'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary btn-md">Cancel</button>
      </div>
    </form>
  )
}
