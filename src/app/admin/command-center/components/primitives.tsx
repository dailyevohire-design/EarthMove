'use client'

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import type { TaskStatus } from '../types'
import { LAUNCH_DATE, SPRINT_START } from '../seed'

// ─── Time helpers ─────────────────────────────────────────────
export const pad = (n: number): string => String(n).padStart(2, '0')
export const daysBetween = (a: Date, b: Date): number => Math.ceil((b.getTime() - a.getTime()) / 86_400_000)
export const pctThrough = (a: Date, b: Date, now: Date): number =>
  Math.min(100, Math.max(0, ((now.getTime() - a.getTime()) / (b.getTime() - a.getTime())) * 100))

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export const fmtUSD = (n: number | null | undefined): string => '$' + (n ?? 0).toLocaleString('en-US')

// ─── Live clock ───────────────────────────────────────────────
export function useClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ─── Countdown ────────────────────────────────────────────────
export function Countdown({ compact = false }: { compact?: boolean }) {
  const now = useClock()
  const ms = LAUNCH_DATE.getTime() - now.getTime()
  const d = Math.max(0, Math.floor(ms / 86_400_000))
  const h = Math.max(0, Math.floor((ms % 86_400_000) / 3_600_000))
  const m = Math.max(0, Math.floor((ms % 3_600_000) / 60_000))
  const s = Math.max(0, Math.floor((ms % 60_000) / 1000))

  if (compact) {
    return (
      <span className="num tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
        T−{pad(d)}<span className="ink-4">:</span>{pad(h)}<span className="ink-4">:</span>{pad(m)}<span className="ink-4">:</span>{pad(s)}
      </span>
    )
  }
  return (
    <div className="flex items-end gap-3">
      <div>
        <div className="kicker">T-Minus</div>
        <div className="num num-huge ink-0">{pad(d)}<span className="ink-4 text-2xl">d</span></div>
      </div>
      <div className="num ink-2" style={{ fontSize: 20, paddingBottom: 8 }}>
        {pad(h)}<span className="ink-4">:</span>{pad(m)}<span className="ink-4">:</span>{pad(s)}
      </div>
    </div>
  )
}

// Helper for header: expose sprint-day read without redefining in every caller
export function SprintDay({ now }: { now: Date }): number {
  return Math.max(1, daysBetween(SPRINT_START, now))
}

// ─── Building blocks ──────────────────────────────────────────
export function Kicker({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <div className={'kicker' + (accent ? ' kicker-accent' : '')}>{children}</div>
}

export interface PanelProps {
  title?: ReactNode
  kicker?: ReactNode
  right?: ReactNode
  children?: ReactNode
  className?: string
  bodyClass?: string
  corners?: boolean
  style?: CSSProperties
}
export function Panel({ title, kicker, right, children, className = '', bodyClass = '', corners, style }: PanelProps) {
  return (
    <div className={'panel ' + (corners ? 'corners ' : '') + className} style={style}>
      {corners && <span className="c-br" />}
      {(title || kicker || right) && (
        <div className="panel-head">
          <div className="flex items-center gap-3">
            {kicker && <span className="ink-4 text-xs">{kicker}</span>}
            {title && <span className="panel-title">{title}</span>}
          </div>
          {right}
        </div>
      )}
      <div className={'panel-body ' + bodyClass}>{children}</div>
    </div>
  )
}

export type ChipKind = 'default' | 'red' | 'amber' | 'green' | 'blue' | 'solid'
export function Chip({ kind = 'default', children }: { kind?: ChipKind; children: ReactNode }) {
  const k =
    kind === 'red'   ? 'chip-red' :
    kind === 'amber' ? 'chip-amber' :
    kind === 'green' ? 'chip-green' :
    kind === 'blue'  ? 'chip-blue' :
    kind === 'solid' ? 'chip-solid' : ''
  return <span className={'chip ' + k}>{children}</span>
}

export function StatusDot({ status }: { status: TaskStatus }) {
  const c =
    status === 'Done'        ? 'dot-green' :
    status === 'Blocked'     ? 'dot-red' :
    status === 'In Progress' ? 'dot-amber' : 'dot-gray'
  return <span className={'dot ' + c} />
}

export const TASK_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Blocked', 'Done', 'Skipped']

export function StatusPill({ status, onChange }: { status: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const color =
    status === 'Done'        ? 'chip-green' :
    status === 'In Progress' ? 'chip-amber' :
    status === 'Blocked'     ? 'chip-red' : ''
  return (
    <div className="relative">
      <select
        value={status}
        onChange={e => onChange(e.target.value as TaskStatus)}
        className={'chip ' + color}
        style={{ paddingRight: 22, cursor: 'pointer', appearance: 'none' }}
      >
        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 6, top: 2, pointerEvents: 'none' }} className="ink-3">▾</span>
    </div>
  )
}

export function Ring({ pct, color, size = 110, children }: { pct: number; color?: string; size?: number; children: ReactNode }) {
  const p = Math.max(0, Math.min(100, pct))
  const style = { '--sz': size + 'px', '--pct': p, '--col': color || 'var(--accent)' } as CSSProperties & Record<string, string | number>
  return <div className="ring" style={style}>{children}</div>
}

export function Bar({ pct, color = 'var(--accent)', height = 4 }: { pct: number; color?: string; height?: number }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ height, background: 'var(--bg-3)', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, width: p + '%', background: color, transition: 'width 0.3s' }} />
    </div>
  )
}

export function Sparkline({ values, color = 'var(--accent)', height = 28, width = 100 }: {
  values: number[]; color?: string; height?: number; width?: number
}) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return x + ',' + y.toFixed(1)
  }).join(' ')
  const last = values[values.length - 1] ?? 0
  const cy = height - ((last - min) / range) * (height - 2) - 1
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={width} cy={cy} r="2" fill={color} />
    </svg>
  )
}
