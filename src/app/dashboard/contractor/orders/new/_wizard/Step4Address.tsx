'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AddressRow = {
  id: string
  label: string | null
  street_line_1: string
  street_line_2: string | null
  city: string
  state: string
  zip: string
}

export type ProjectOption = {
  id: string
  name: string
  phase_label: string | null
}

type Props = {
  addresses: AddressRow[]
  projects: ProjectOption[]
  value: {
    delivery_address_id?: string
    project_id?: string | null
    requested_delivery_date?: string | null
    delivery_notes?: string | null
  }
  onChange: (v: {
    delivery_address_id: string
    project_id: string | null
    requested_delivery_date: string | null
    delivery_notes: string | null
  }) => void
  onAddressAdded: (a: AddressRow) => void
  profileId: string
}

export function Step4Address({ addresses, projects, value, onChange, onAddressAdded, profileId }: Props) {
  const [adding, setAdding] = useState(false)
  const [newAddr, setNewAddr] = useState({ label: '', street_line_1: '', city: '', state: '', zip: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedId = value.delivery_address_id ?? ''

  function patch(partial: Partial<Parameters<typeof onChange>[0]>) {
    onChange({
      delivery_address_id: partial.delivery_address_id ?? value.delivery_address_id ?? '',
      project_id: partial.project_id ?? value.project_id ?? null,
      requested_delivery_date: partial.requested_delivery_date ?? value.requested_delivery_date ?? null,
      delivery_notes: partial.delivery_notes ?? value.delivery_notes ?? null,
    })
  }

  async function saveAddress() {
    if (!newAddr.street_line_1 || !newAddr.city || !newAddr.state || !newAddr.zip) {
      setErr('Street, city, state, zip are required.')
      return
    }
    setSaving(true); setErr(null)
    try {
      const db = createClient()
      const { data, error } = await db.from('addresses').insert({
        profile_id: profileId,
        label: newAddr.label || null,
        street_line_1: newAddr.street_line_1,
        city: newAddr.city, state: newAddr.state, zip: newAddr.zip,
        is_default: addresses.length === 0,
      }).select('id, label, street_line_1, street_line_2, city, state, zip').single()
      if (error || !data) throw new Error(error?.message ?? 'Save failed')
      onAddressAdded(data as AddressRow)
      patch({ delivery_address_id: data.id })
      setAdding(false)
      setNewAddr({ label: '', street_line_1: '', city: '', state: '', zip: '' })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="ec-field">
        <label className="ec-field__label">Delivery address</label>
        <select
          className="ec-field__input"
          value={selectedId}
          onChange={e => patch({ delivery_address_id: e.target.value })}
        >
          <option value="">— Select —</option>
          {addresses.map(a => (
            <option key={a.id} value={a.id}>
              {(a.label ? `${a.label} — ` : '') + `${a.street_line_1}, ${a.city} ${a.state} ${a.zip}`}
            </option>
          ))}
        </select>
        {!adding && (
          <button type="button" className="ec-btn ec-btn--ghost" onClick={() => setAdding(true)} style={{ marginTop: 6, alignSelf: 'flex-start', padding: '4px 0' }}>
            + New address
          </button>
        )}
      </div>

      {adding && (
        <div style={{ background: 'var(--bone-100)', padding: 16, borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          <div className="ec-field">
            <label className="ec-field__label">Label (optional)</label>
            <input className="ec-field__input" value={newAddr.label} onChange={e => setNewAddr({ ...newAddr, label: e.target.value })} placeholder="e.g. Oakwood Crossing main entrance" />
          </div>
          <div className="ec-field">
            <label className="ec-field__label">Street</label>
            <input className="ec-field__input" value={newAddr.street_line_1} onChange={e => setNewAddr({ ...newAddr, street_line_1: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px', gap: 10 }}>
            <div className="ec-field">
              <label className="ec-field__label">City</label>
              <input className="ec-field__input" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} />
            </div>
            <div className="ec-field">
              <label className="ec-field__label">State</label>
              <input className="ec-field__input" value={newAddr.state} onChange={e => setNewAddr({ ...newAddr, state: e.target.value.toUpperCase().slice(0, 2) })} />
            </div>
            <div className="ec-field">
              <label className="ec-field__label">ZIP</label>
              <input className="ec-field__input" value={newAddr.zip} onChange={e => setNewAddr({ ...newAddr, zip: e.target.value })} />
            </div>
          </div>
          {err && <div style={{ color: 'var(--clay-700)', fontSize: 12, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ec-btn ec-btn--primary" onClick={saveAddress} disabled={saving}>
              {saving ? 'Saving…' : 'Save address'}
            </button>
            <button type="button" className="ec-btn ec-btn--secondary" onClick={() => { setAdding(false); setErr(null) }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ec-field">
        <label className="ec-field__label">Project (optional)</label>
        <select
          className="ec-field__input"
          value={value.project_id ?? ''}
          onChange={e => patch({ project_id: e.target.value || null })}
        >
          <option value="">— None —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.phase_label ? ` — ${p.phase_label}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="ec-field">
        <label className="ec-field__label">Requested delivery date</label>
        <input
          type="date"
          className="ec-field__input"
          value={value.requested_delivery_date ?? ''}
          onChange={e => patch({ requested_delivery_date: e.target.value || null })}
        />
      </div>

      <div className="ec-field">
        <label className="ec-field__label">Delivery notes (optional)</label>
        <textarea
          className="ec-field__input"
          style={{ minHeight: 80, fontFamily: 'inherit' }}
          value={value.delivery_notes ?? ''}
          onChange={e => patch({ delivery_notes: e.target.value })}
          placeholder="Gate code, superintendent contact, truck access notes…"
        />
      </div>
    </div>
  )
}
