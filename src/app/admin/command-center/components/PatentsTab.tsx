'use client'

import { useMemo } from 'react'
import type { DashboardState, PatentStatus } from '../types'
import { SEED_PATENTS } from '../seed'
import { Panel, Kicker, useClock } from './primitives'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

const PATENT_STATUS: PatentStatus[] = [
  'Pending', 'Drafting', 'In Counsel Review', 'Filed', 'Granted', 'Abandoned',
]

export default function PatentsTab({
  data, setData,
}: {
  data: DashboardState
  setData: (u: Updater) => void
}) {
  const prov = data.provisional
  const now = useClock()

  const sorted = useMemo(() => {
    return SEED_PATENTS.map(p => {
      const due = new Date(p.dueDate + 'T23:59:59')
      const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
      const filed = p.id === 'p0' && prov.filed
      return { ...p, days, filed }
    })
  }, [now, prov.filed])

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 pb-2">
        <div className="text-xs ink-2">Countdown to Track One filings, PCT deadlines, and 4th provisional.</div>
        <div className="kicker">Red ≤ 7d · Amber ≤ 30d</div>
      </div>
      <div className="space-y-3">
        {sorted.map((p, i) => {
          const state = data.patents[p.id]
          const badge = p.filed
            ? { label: 'FILED', color: 'var(--green)' }
            : p.days < 0
              ? { label: 'OVERDUE · ' + Math.abs(p.days) + 'd', color: 'var(--red)' }
              : p.days < 7
                ? { label: p.days + 'd', color: 'var(--red)' }
                : p.days < 30
                  ? { label: p.days + 'd', color: 'var(--amber)' }
                  : { label: p.days + 'd', color: 'var(--ink-1)' }
          const isProv = p.id === 'p0'
          return (
            <Panel key={p.id} corners bodyClass="p-0">
              <div className="grid" style={{ gridTemplateColumns: '60px 1fr 120px 1fr', gap: 18, padding: 16, alignItems: 'start' }}>
                <div>
                  <div className="num text-xl ink-0">{String(i + 1).padStart(2, '0')}</div>
                  <div className="kicker mt-1">P·{p.id.replace('p-', '').replace('p', '')}</div>
                </div>
                <div>
                  <Kicker>{p.type}</Kicker>
                  <div className="text-base ink-0 mt-1 display-serif">{p.title}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs ink-3">
                    <span className="num">{p.cost}</span>
                    <span>· target {p.dueDate}</span>
                  </div>
                  <div className="text-xs ink-2 mt-2">{p.notes}</div>
                </div>
                <div>
                  <div
                    className="num text-center"
                    style={{
                      fontSize: 28,
                      color: badge.color,
                      border: '1px solid ' + badge.color,
                      padding: '8px',
                      letterSpacing: '-0.02em',
                    }}
                  >{badge.label}</div>
                </div>
                <div className="space-y-2">
                  {isProv ? (
                    <div
                      className="text-xs px-3 py-2 text-center"
                      style={{
                        border: '1px solid ' + (prov.filed ? 'var(--green)' : 'var(--red)'),
                        color: prov.filed ? 'var(--green)' : 'var(--red)',
                        background: prov.filed ? 'rgba(111,207,151,0.06)' : 'rgba(255,90,78,0.06)',
                      }}
                    >
                      {prov.filed ? 'Filed' + (prov.filedDate ? ' · ' + prov.filedDate : '') : 'NOT FILED · see Decisions'}
                    </div>
                  ) : (
                    <select
                      value={state?.status ?? 'Pending'}
                      onChange={e => setData(prev => ({
                        ...prev,
                        patents: {
                          ...prev.patents,
                          [p.id]: {
                            serial: state?.serial ?? '',
                            counsel: state?.counsel ?? '',
                            notes: state?.notes ?? '',
                            status: e.target.value as PatentStatus,
                          },
                        },
                      }))}
                      className="w-full"
                    >
                      {PATENT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Serial #"
                      value={isProv ? prov.receipt : (state?.serial ?? '')}
                      onChange={e => {
                        if (isProv) {
                          setData(pr => ({ ...pr, provisional: { ...pr.provisional, receipt: e.target.value } }))
                        } else {
                          setData(pr => ({
                            ...pr,
                            patents: {
                              ...pr.patents,
                              [p.id]: {
                                status: state?.status ?? 'Pending',
                                counsel: state?.counsel ?? '',
                                notes: state?.notes ?? '',
                                serial: e.target.value,
                              },
                            },
                          }))
                        }
                      }}
                    />
                    <input
                      placeholder="Counsel"
                      value={state?.counsel ?? ''}
                      onChange={e => setData(pr => ({
                        ...pr,
                        patents: {
                          ...pr.patents,
                          [p.id]: {
                            status: state?.status ?? 'Pending',
                            serial: state?.serial ?? '',
                            notes: state?.notes ?? '',
                            counsel: e.target.value,
                          },
                        },
                      }))}
                    />
                  </div>
                </div>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
