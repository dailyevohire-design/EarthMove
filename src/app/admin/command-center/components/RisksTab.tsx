'use client'

import { Fragment } from 'react'
import type { DashboardState, RiskStatus } from '../types'
import { SEED_RISKS } from '../seed'
import { Panel, Kicker, Chip } from './primitives'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

const RISK_STATUS: RiskStatus[] = ['Open', 'Mitigating', 'Contained', 'Realized', 'Closed']

export default function RisksTab({
  data, setData,
}: {
  data: DashboardState
  setData: (u: Updater) => void
}) {
  const sorted = [...SEED_RISKS].sort((a, b) => (b.severity * b.likelihood) - (a.severity * a.likelihood))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <Panel title="Severity × Likelihood" kicker="heat map" corners bodyClass="p-4">
          <div className="flex gap-4 items-end">
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="kicker">Likelihood →</div>
            <div>
              <div className="grid" style={{ gridTemplateColumns: 'auto repeat(5, 42px)', gap: 2 }}>
                <div></div>
                {[1, 2, 3, 4, 5].map(s => <div key={s} className="kicker text-center">S{s}</div>)}
                {[5, 4, 3, 2, 1].map(l => (
                  <Fragment key={l}>
                    <div className="kicker" style={{ minWidth: 20 }}>L{l}</div>
                    {[1, 2, 3, 4, 5].map(sev => {
                      const score = sev * l
                      const risks = SEED_RISKS.filter(r => r.severity === sev && r.likelihood === l)
                      const tone =
                        score >= 20 ? 'heat-5' :
                        score >= 15 ? 'heat-4' :
                        score >= 9  ? 'heat-3' :
                        score >= 5  ? 'heat-2' : 'heat-1'
                      return (
                        <div
                          key={sev + '-' + l}
                          className={'heat-cell ' + tone}
                          title={risks.map(r => r.name).join(', ') || 'empty'}
                        >
                          {risks.length > 0 && <span className="num" style={{ fontSize: 11 }}>{risks.length}</span>}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
              <div className="kicker mt-2 text-center" style={{ paddingLeft: 40 }}>Severity →</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 text-xs ink-3">
            <span className="flex items-center gap-1"><span className="heat-cell heat-1" style={{ width: 12, height: 12 }} /> 1–4</span>
            <span className="flex items-center gap-1"><span className="heat-cell heat-3" style={{ width: 12, height: 12 }} /> 9–12</span>
            <span className="flex items-center gap-1"><span className="heat-cell heat-4" style={{ width: 12, height: 12 }} /> 15–16</span>
            <span className="flex items-center gap-1"><span className="heat-cell heat-5" style={{ width: 12, height: 12 }} /> 20–25</span>
          </div>
        </Panel>

        <Panel title="Register at a glance" kicker="compressed from 72 role-attributed" corners bodyClass="p-0">
          <div className="p-4 grid grid-cols-3 gap-3">
            <div>
              <div className="num text-2xl ink-0">
                {SEED_RISKS.filter(r => data.risks[r.id]?.status === 'Open').length}
              </div>
              <div className="kicker mt-1 c-red">Open</div>
            </div>
            <div>
              <div className="num text-2xl ink-0">
                {SEED_RISKS.filter(r => data.risks[r.id]?.status === 'Mitigating').length}
              </div>
              <div className="kicker mt-1 c-amber">Mitigating</div>
            </div>
            <div>
              <div className="num text-2xl ink-0">
                {SEED_RISKS.filter(r => {
                  const s = data.risks[r.id]?.status
                  return s === 'Contained' || s === 'Closed'
                }).length}
              </div>
              <div className="kicker mt-1 c-green">Contained</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            {sorted.slice(0, 3).map(r => {
              const score = r.severity * r.likelihood
              const status = data.risks[r.id]?.status ?? 'Open'
              return (
                <div key={r.id} className="p-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--line)' }}>
                  <div className="num text-lg" style={{ color: score >= 15 ? 'var(--red)' : 'var(--amber)', minWidth: 36 }}>{score}</div>
                  <div className="flex-1 min-w-0 text-xs ink-1 truncate">{r.name}</div>
                  <Chip kind={status === 'Open' ? 'red' : 'amber'}>{status}</Chip>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        {sorted.map((r, i) => {
          const state = data.risks[r.id]
          const score = r.severity * r.likelihood
          const sev: 'red' | 'amber' | 'green' = score >= 15 ? 'red' : score >= 9 ? 'amber' : 'green'
          return (
            <Panel key={r.id} corners bodyClass="p-0">
              <div className="p-4 grid" style={{ gridTemplateColumns: '60px 1fr 1fr', gap: 20, alignItems: 'start' }}>
                <div>
                  <div className="num text-3xl" style={{ color: sev === 'red' ? 'var(--red)' : sev === 'amber' ? 'var(--amber)' : 'var(--green)' }}>{score}</div>
                  <div className="kicker mt-1">RISK</div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="kicker" style={{ fontSize: 9 }}>SEV</div>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <span key={n} style={{ width: 5, height: 8, background: n <= r.severity ? (sev === 'red' ? 'var(--red)' : 'var(--amber)') : 'var(--bg-3)' }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="kicker" style={{ fontSize: 9 }}>LKL</div>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <span key={n} style={{ width: 5, height: 8, background: n <= r.likelihood ? (sev === 'red' ? 'var(--red)' : 'var(--amber)') : 'var(--bg-3)' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="kicker">Risk · {String(i + 1).padStart(2, '0')}</div>
                  <div className="text-lg ink-0 mt-1 display-serif">{r.name}</div>
                  <div className="mt-2 flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    {r.roles.map(role => <Chip key={role}>{role}</Chip>)}
                  </div>
                  <div className="mt-3">
                    <Kicker>Mitigation</Kicker>
                    <div className="text-xs ink-1 mt-1 leading-snug">{r.mitigation}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Kicker>Status</Kicker>
                    <div className="flex items-center mt-1" style={{ border: '1px solid var(--line)' }}>
                      {RISK_STATUS.map(opt => {
                        const active = (state?.status ?? 'Open') === opt
                        return (
                          <button
                            key={opt}
                            onClick={() => setData(p => ({
                              ...p,
                              risks: {
                                ...p.risks,
                                [r.id]: {
                                  changeMyMind: state?.changeMyMind ?? '',
                                  owner: state?.owner ?? (r.roles[0] ?? ''),
                                  status: opt,
                                },
                              },
                            }))}
                            className="flex-1"
                            style={{
                              padding: '5px 4px',
                              fontSize: 9,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              background: active ? 'var(--accent)' : 'transparent',
                              color: active ? 'var(--bg-0)' : 'var(--ink-3)',
                              border: 'none',
                              borderRight: opt !== 'Closed' ? '1px solid var(--line)' : 'none',
                              fontWeight: active ? 600 : 400,
                            }}
                          >{opt}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <Kicker>What would change my mind</Kicker>
                    <textarea
                      value={state?.changeMyMind ?? ''}
                      onChange={e => setData(p => ({
                        ...p,
                        risks: {
                          ...p.risks,
                          [r.id]: {
                            status: state?.status ?? 'Open',
                            owner: state?.owner ?? (r.roles[0] ?? ''),
                            changeMyMind: e.target.value,
                          },
                        },
                      }))}
                      placeholder="evidence that would downgrade or close this risk…"
                      className="w-full mt-1"
                      style={{ minHeight: 54 }}
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
