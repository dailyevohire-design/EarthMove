'use client'

import { useMemo, useState } from 'react'
import type { DashboardState, GateState, GateStatus, SeedGate } from '../types'
import { DELAY_TRIGGERS, PIVOT_TRIGGERS, SEED_GATES, SIGNOFF_SEATS } from '../seed'
import { Panel, Kicker, Ring, Bar } from './primitives'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

export default function GatesTab({
  data, setData,
}: {
  data: DashboardState
  setData: (u: Updater) => void
}) {
  const byCat = useMemo(() => {
    const m: Record<string, (SeedGate & { _idx: number })[]> = {}
    SEED_GATES.forEach((g, i) => {
      if (!m[g.category]) m[g.category] = []
      m[g.category]!.push({ ...g, _idx: i })
    })
    return m
  }, [])

  const stats = useMemo(() => {
    const o = { green: 0, yellow: 0, red: 0 }
    SEED_GATES.forEach(g => {
      const s = data.gates[g.id]?.status ?? 'Red'
      if (s === 'Green') o.green++
      else if (s === 'Yellow') o.yellow++
      else o.red++
    })
    return o
  }, [data])

  const pct = Math.round((stats.green / SEED_GATES.length) * 100)
  const signoffDone = Object.values(data.signoffs).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <Panel corners bodyClass="p-4" className="grid-bg">
          <div className="flex items-center gap-5">
            <Ring pct={pct} size={130} color={pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'}>
              <div className="text-center">
                <div className="num num-huge ink-0" style={{ fontSize: 40 }}>{pct}<span className="ink-4 text-sm">%</span></div>
                <div className="kicker mt-1">READY</div>
              </div>
            </Ring>
            <div className="flex-1">
              <Kicker accent>Launch Readiness · 12 Tier-1 Gates</Kicker>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="dot dot-green" />
                  <div className="flex-1"><Bar pct={(stats.green / SEED_GATES.length) * 100} color="var(--green)" height={6} /></div>
                  <span className="num ink-0 text-sm">{stats.green}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="dot dot-amber" />
                  <div className="flex-1"><Bar pct={(stats.yellow / SEED_GATES.length) * 100} color="var(--amber)" height={6} /></div>
                  <span className="num ink-0 text-sm">{stats.yellow}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="dot dot-red" />
                  <div className="flex-1"><Bar pct={(stats.red / SEED_GATES.length) * 100} color="var(--red)" height={6} /></div>
                  <span className="num ink-0 text-sm">{stats.red}</span>
                </div>
              </div>
              <div className="kicker mt-3 ink-3">Gate review · Week 3 · May 11 · COO-led</div>
            </div>
          </div>
        </Panel>

        <Panel title="Sign-off Matrix" kicker="24 seats" corners bodyClass="p-3">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {SIGNOFF_SEATS.map(seat => {
              const signed = data.signoffs[seat]
              return (
                <button
                  key={seat}
                  onClick={() => setData(p => ({ ...p, signoffs: { ...p.signoffs, [seat]: !signed } }))}
                  className="text-xs"
                  style={{
                    padding: '4px 2px',
                    border: '1px solid ' + (signed ? 'var(--green)' : 'var(--line)'),
                    background: signed ? 'rgba(111,207,151,0.1)' : 'var(--bg-2)',
                    color: signed ? 'var(--green)' : 'var(--ink-3)',
                    fontSize: 9,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                  title={seat + (signed ? ' · signed' : ' · pending')}
                >
                  {signed && '✓'} {seat}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="kicker">Signed</span>
            <span className="num ink-0 text-lg">{signoffDone}<span className="ink-4 text-xs"> / 24</span></span>
          </div>
          <Bar pct={(signoffDone / 24) * 100} color="var(--green)" height={3} />
        </Panel>

        <Panel title="Launch Lock" kicker="all must pass" corners bodyClass="p-4">
          <div className="space-y-2 text-xs">
            <Lock label="12/12 gates green" ok={stats.green === 12} />
            <Lock label="24/24 seats signed" ok={signoffDone === 24} />
            <Lock label="4th provisional filed" ok={data.provisional.filed} />
            <Lock label="≥3 reporters embargoed" ok={data.gates.g8?.status === 'Green'} />
            <Lock label="HoO named OR Opt-2 ratified" ok={data.gates.g9?.status === 'Green'} />
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--line)' }}>
            <div className="flex items-center justify-between">
              <span className="kicker">Verdict</span>
              {(stats.green === 12 && signoffDone === 24 && data.provisional.filed) ? (
                <span className="stamp c-green">CLEARED FOR LAUNCH</span>
              ) : (
                <span className="stamp c-red">NO-GO · HOLD</span>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        {Object.entries(byCat).map(([cat, gates]) => (
          <Panel
            key={cat}
            title={cat}
            kicker={gates.length + ' ' + (gates.length === 1 ? 'gate' : 'gates')}
            corners
            bodyClass="p-0"
            right={
              <div className="flex items-center gap-1">
                {gates.map(g => {
                  const s = data.gates[g.id]?.status ?? 'Red'
                  return <span key={g.id} className={'dot ' + (s === 'Green' ? 'dot-green' : s === 'Yellow' ? 'dot-amber' : 'dot-red')} />
                })}
              </div>
            }
          >
            {gates.map(g => {
              const state: GateState = data.gates[g.id] ?? { status: 'Red', notes: '' }
              return (
                <GateRow
                  key={g.id}
                  gate={g}
                  state={state}
                  onChange={patch => setData(p => ({
                    ...p,
                    gates: { ...p.gates, [g.id]: { status: state.status, notes: state.notes, ...patch } },
                  }))}
                />
              )
            })}
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Delay Triggers · 30–60d" kicker="hold at the seam" corners bodyClass="p-0">
          {DELAY_TRIGGERS.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3"
              style={{ borderBottom: i < DELAY_TRIGGERS.length - 1 ? '1px solid var(--line)' : 'none' }}
            >
              <span className="kicker num shrink-0" style={{ minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="c-amber shrink-0" style={{ marginTop: 2 }}>▲</span>
              <span className="text-xs ink-1 flex-1">{t}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Pivot Triggers · reassess thesis" kicker="competitive" corners bodyClass="p-0">
          {PIVOT_TRIGGERS.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3"
              style={{ borderBottom: i < PIVOT_TRIGGERS.length - 1 ? '1px solid var(--line)' : 'none' }}
            >
              <span className="kicker num shrink-0" style={{ minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="c-red shrink-0" style={{ marginTop: 2 }}>◆</span>
              <span className="text-xs ink-1 flex-1">{t}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}

function Lock({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          width: 14, height: 14,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid ' + (ok ? 'var(--green)' : 'var(--line-2)'),
          color: ok ? 'var(--green)' : 'var(--ink-3)',
        }}
      >{ok ? '✓' : '·'}</span>
      <span className={ok ? 'ink-1' : 'ink-3'}>{label}</span>
    </div>
  )
}

function GateRow({
  gate, state, onChange,
}: {
  gate: SeedGate & { _idx: number }
  state: GateState
  onChange: (patch: Partial<GateState>) => void
}) {
  const [open, setOpen] = useState<boolean>(false)
  const s = state.status
  const dotCls = s === 'Green' ? 'dot-green' : s === 'Yellow' ? 'dot-amber' : 'dot-red'
  const statuses: GateStatus[] = ['Red', 'Yellow', 'Green']
  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="p-3 grid" style={{ gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'start' }}>
        <span className={'dot ' + dotCls} style={{ marginTop: 6 }} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="kicker num c-accent">GATE {String(gate._idx + 1).padStart(2, '0')}</span>
            <span className="kicker ink-3">· {gate.owner}</span>
          </div>
          <div className="text-sm ink-0 leading-snug">{gate.title}</div>
          <div className="text-xs ink-3 mt-1"><span className="ink-4">verify ▸ </span>{gate.verify}</div>
          {open && (
            <div className="mt-3">
              <Kicker>Gate notes</Kicker>
              <textarea
                value={state.notes}
                onChange={e => onChange({ notes: e.target.value })}
                placeholder="evidence · links · status changes…"
                className="w-full mt-1"
                style={{ minHeight: 50 }}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center" style={{ border: '1px solid var(--line)' }}>
            {statuses.map(opt => {
              const active = s === opt
              const col = opt === 'Green' ? 'var(--green)' : opt === 'Yellow' ? 'var(--amber)' : 'var(--red)'
              return (
                <button
                  key={opt}
                  onClick={() => onChange({ status: opt })}
                  style={{
                    padding: '5px 12px',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    background: active ? col : 'transparent',
                    color: active ? 'var(--bg-0)' : 'var(--ink-3)',
                    border: 'none',
                    borderRight: opt !== 'Green' ? '1px solid var(--line)' : 'none',
                    fontWeight: active ? 600 : 400,
                  }}
                >{opt}</button>
              )
            })}
          </div>
          <button className="btn btn-ghost text-xs" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Notes'}</button>
        </div>
      </div>
    </div>
  )
}
