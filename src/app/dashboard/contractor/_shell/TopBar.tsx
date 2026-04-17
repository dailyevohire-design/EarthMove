'use client'

import { useState } from 'react'

type Props = {
  initials: string
  alertCount?: number
  userDisplay: string
}

export function TopBar({ initials, alertCount = 0, userDisplay }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  async function signOut() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  return (
    <header className="ec-topbar">
      <div className="ec-topbar__search">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input placeholder="Search projects, orders, suppliers…" aria-label="Search" />
      </div>
      <div className="ec-topbar__right">
        <button className="ec-topbar__bell" aria-label={`${alertCount} alerts`}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" strokeLinejoin="round" />
            <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
          {alertCount > 0 && <span className="ec-topbar__bell-dot" />}
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className="ec-avatar"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={userDisplay}
            aria-expanded={menuOpen}
          >
            {initials}
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: '#fff', border: 'var(--edge-strong)',
                borderRadius: 10, minWidth: 180, padding: 6,
                boxShadow: '0 10px 30px -10px rgba(10,15,12,0.25)', zIndex: 10,
              }}
            >
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--ink-500)', borderBottom: 'var(--edge)' }}>
                {userDisplay}
              </div>
              <button
                onClick={signOut}
                style={{ width: '100%', textAlign: 'left', padding: '9px 10px', fontSize: 13.5, color: 'var(--clay-700)', borderRadius: 7 }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
