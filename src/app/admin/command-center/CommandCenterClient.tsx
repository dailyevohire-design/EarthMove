'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { DashboardState, TabKey } from './types'
import { buildInitial } from './seed'
import { useDashboardState } from './useDashboardState'
import { Countdown, fmtDateTime, daysBetween, useClock } from './components/primitives'
import { SPRINT_START } from './seed'
import SprintTab from './components/SprintTab'
import GatesTab from './components/GatesTab'
import RisksTab from './components/RisksTab'
import DecisionsTab from './components/DecisionsTab'
import PatentsTab from './components/PatentsTab'

type Accent = 'amber' | 'cyan' | 'green' | 'red' | 'violet'
type Density = 'compact' | 'default' | 'comfy'
type Theme = 'dark' | 'light'

interface Tweaks {
  accent: Accent
  density: Density
  theme: Theme
}

const TABS: readonly { key: TabKey; label: string; num: string }[] = [
  { key: 'sprint',    label: 'Sprint',    num: '01' },
  { key: 'gates',     label: 'Gates',     num: '02' },
  { key: 'risks',     label: 'Risks',     num: '03' },
  { key: 'decisions', label: 'Decisions', num: '04' },
  { key: 'patents',   label: 'Patents',   num: '05' },
]

export default function CommandCenterClient({
  userId,
  initial,
  initialUpdatedAt,
}: {
  userId: string
  initial: DashboardState
  initialUpdatedAt: string | null
}) {
  const { data, setData, saving, lastSaved, error } = useDashboardState(userId, initial, initialUpdatedAt)
  const [tab, setTab] = useState<TabKey>('sprint')
  const [tweaksOpen, setTweaksOpen] = useState<boolean>(false)
  const [tweaks, setTweaks] = useState<Tweaks>({ accent: 'amber', density: 'default', theme: 'dark' })
  const [mounted, setMounted] = useState<boolean>(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const now = useClock()

  useEffect(() => { setMounted(true) }, [])

  const urgent = !data.provisional.filed
  const sprintDay = Math.max(1, daysBetween(SPRINT_START, now))

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'epc-dash-' + new Date().toISOString().split('T')[0] + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJSON = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? ''))
        setData(parsed as DashboardState)
      } catch {
        alert('Invalid JSON')
      }
    }
    r.readAsText(f)
    e.target.value = ''
  }

  const resetAll = () => {
    if (confirm('Reset all dashboard data?')) setData(buildInitial())
  }

  return (
    <div
      className="cc-scope"
      data-accent={tweaks.accent}
      data-density={tweaks.density}
      data-theme={tweaks.theme}
    >
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-0)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1500, margin: '0 auto', padding: '10px 20px' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect x="1" y="1" width="30" height="30" stroke="currentColor" strokeWidth="1" className="ink-2" />
                <path d="M8 22L16 8L24 22" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
                <circle cx="16" cy="22" r="1.5" fill="var(--accent)" />
                <path d="M8 22H24" stroke="currentColor" strokeWidth="1" className="ink-3" />
              </svg>
              <div>
                <div className="kicker" style={{ color: 'var(--accent)' }}>Earth Pro Connect</div>
                <div className="text-xs ink-1" style={{ letterSpacing: '0.02em', fontWeight: 500 }}>
                  Operator Dashboard / Launch <span className="ink-3">2026-05-12</span>
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {mounted && (
              <div className="flex items-center gap-2 px-3 py-1" style={{ border: '1px solid var(--line)', background: 'var(--bg-1)' }}>
                <span className="kicker">T-minus</span>
                <Countdown compact />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs ink-3 md-hide">
              <span className="dot dot-amber pulse" />
              <span>DFW · Denver · 08:00 CT</span>
            </div>

            <div className="flex items-center gap-1">
              <button className="btn btn-ghost text-xs" onClick={exportJSON} title="Export JSON">↓ Export</button>
              <button className="btn btn-ghost text-xs" onClick={() => fileRef.current?.click()} title="Import JSON">↑ Import</button>
              <button className="btn btn-ghost text-xs btn-danger" onClick={resetAll}>Reset</button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} style={{ display: 'none' }} />
            </div>

            {/* Save indicator: saving replaces the lastSaved text while in flight */}
            <div className="text-xs ink-4 md-hide" style={{ minWidth: 130, textAlign: 'right' }}>
              {error ? (
                <span className="c-red">⚠ {error.slice(0, 40)}</span>
              ) : saving ? (
                <>
                  <span className="dot dot-amber" style={{ width: 5, height: 5, marginRight: 4, display: 'inline-block' }} />
                  saving…
                </>
              ) : lastSaved ? (
                <>
                  <span className="dot dot-green" style={{ width: 5, height: 5, marginRight: 4, display: 'inline-block' }} />
                  saved {fmtDateTime(lastSaved)}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          <div style={{ maxWidth: 1500, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                className={'tab' + (tab === t.key ? ' active' : '')}
                onClick={() => setTab(t.key)}
              >
                <span className="tab-idx num">{t.num}</span>
                {t.label}
                {t.key === 'decisions' && urgent && <span className="dot dot-red pulse" style={{ width: 6, height: 6 }} />}
              </button>
            ))}
            <div className="flex-1" />
            <span className="kicker" style={{ padding: '0 12px' }}>
              Sprint Day <span className="ink-1 num">{sprintDay}</span> / 112
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1500, margin: '0 auto', padding: '20px' }}>
        {/* Urgent provisional banner — promoted to top-of-page since there is no Today tab */}
        {urgent && (
          <div className="banner-urgent mb-4" style={{ position: 'relative' }}>
            <div className="flex items-center gap-4 py-3 px-4" style={{ position: 'relative', zIndex: 2 }}>
              <div className="flex items-center gap-2 shrink-0">
                <span className="dot dot-red pulse" style={{ width: 10, height: 10 }} />
                <span className="kicker" style={{ color: 'var(--red)' }}>Active · Priority 0</span>
              </div>
              <div className="flex-1">
                <div className="text-sm ink-0 font-semibold">
                  Fourth provisional <span className="ink-2">($65 micro-entity)</span> — file today, April 22
                </div>
                <div className="text-xs ink-2 mt-1">
                  Binary. Urgent. Not reversible past end-of-day. If not filed, PCT deadline moves to April 20, 2027 and claim set must be re-scoped.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="btn btn-primary" onClick={() => setTab('decisions')}>Resolve →</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'sprint'    && <SprintTab    data={data} setData={setData} />}
        {tab === 'gates'     && <GatesTab     data={data} setData={setData} />}
        {tab === 'risks'     && <RisksTab     data={data} setData={setData} />}
        {tab === 'decisions' && <DecisionsTab data={data} setData={setData} />}
        {tab === 'patents'   && <PatentsTab   data={data} setData={setData} />}
      </main>

      <footer style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--line)', marginTop: 40 }}>
        <div className="kicker">· OPERATOR SEAT / EPC-HQ / CLASSIFIED ·</div>
        <div className="kicker">v3 · supabase persist · export regularly</div>
      </footer>

      {tweaksOpen && (
        <div className="tweaks">
          <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="panel-title">Tweaks</span>
            <button className="btn btn-ghost text-xs" onClick={() => setTweaksOpen(false)}>✕</button>
          </div>
          <div className="tweak-row">
            <label>Accent</label>
            <div className="flex gap-1">
              {([
                ['amber',  '#f7b733'],
                ['cyan',   '#5ce1e6'],
                ['green',  '#6fcf97'],
                ['red',    '#ff7a6e'],
                ['violet', '#b48cff'],
              ] as const).map(([name, hex]) => (
                <div
                  key={name}
                  className={'swatch' + (tweaks.accent === name ? ' active' : '')}
                  style={{ background: hex }}
                  onClick={() => setTweaks(t => ({ ...t, accent: name }))}
                />
              ))}
            </div>
          </div>
          <div className="tweak-row">
            <label>Density</label>
            <div className="flex items-center" style={{ border: '1px solid var(--line)' }}>
              {(['compact', 'default', 'comfy'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTweaks(t => ({ ...t, density: d }))}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: tweaks.density === d ? 'var(--accent)' : 'transparent',
                    color: tweaks.density === d ? 'var(--bg-0)' : 'var(--ink-3)',
                    border: 'none',
                    borderRight: d !== 'comfy' ? '1px solid var(--line)' : 'none',
                  }}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="tweak-row">
            <label>Theme</label>
            <div className="flex items-center" style={{ border: '1px solid var(--line)' }}>
              {(['dark', 'light'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTweaks(t => ({ ...t, theme: d }))}
                  style={{
                    padding: '4px 10px',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: tweaks.theme === d ? 'var(--accent)' : 'transparent',
                    color: tweaks.theme === d ? 'var(--bg-0)' : 'var(--ink-3)',
                    border: 'none',
                    borderRight: d !== 'light' ? '1px solid var(--line)' : 'none',
                  }}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="mt-2 pt-2 text-xs ink-3" style={{ borderTop: '1px dashed var(--line)' }}>
            Session-local. Preferences reset on refresh.
          </div>
        </div>
      )}

      {!tweaksOpen && (
        <button
          className="btn btn-ghost"
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 49, fontSize: 10, padding: '6px 10px', background: 'var(--bg-1)' }}
          onClick={() => setTweaksOpen(true)}
        >⚙ Tweaks</button>
      )}
    </div>
  )
}
