'use client'

import { useMemo, useState } from 'react'
import { MaterialSwatch } from '@/components/contractor/MaterialSwatch'

export type MaterialOption = {
  id: string
  name: string
  slug: string
  category_name: string | null
  default_unit: 'ton' | 'cuyd'
}

type Props = {
  materials: MaterialOption[]
  value: { material_catalog_id?: string }
  onChange: (m: MaterialOption) => void
}

export function Step1Material({ materials, value, onChange }: Props) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return materials
    return materials.filter(m =>
      m.name.toLowerCase().includes(t)
      || m.slug.toLowerCase().includes(t)
      || (m.category_name ?? '').toLowerCase().includes(t),
    )
  }, [materials, q])

  return (
    <div>
      <div className="ec-filter-input">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          placeholder="Search 88 materials…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search materials"
        />
      </div>

      <div className="ec-materials" role="radiogroup" aria-label="Material">
        {filtered.map(m => {
          const selected = value.material_catalog_id === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`ec-material-card ${selected ? 'selected' : ''}`}
              onClick={() => onChange(m)}
            >
              <div className="ec-material-card__top">
                <MaterialSwatch slug={m.slug} />
                <span className="ec-material-card__name">{m.name}</span>
              </div>
              <span className="ec-material-card__cat">{m.category_name ?? '—'}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 20, color: 'var(--ink-500)', fontSize: 13 }}>
            No materials match "{q}".
          </div>
        )}
      </div>
    </div>
  )
}
