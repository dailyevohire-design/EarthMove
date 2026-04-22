'use client'

import type { DashboardState, SeedDecisionOption } from '../types'
import { SEED_DECISIONS } from '../seed'
import { Panel, Kicker, Chip, fmtDateTime } from './primitives'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

export default function DecisionsTab({
  data, setData,
}: {
  data: DashboardState
  setData: (u: Updater) => void
}) {
  const prov = data.provisional

  return (
    <div className="space-y-4">
      {/* Priority-0 provisional banner */}
      <Panel corners bodyClass="p-0">
        <div
          style={{
            background: prov.filed
              ? 'linear-gradient(90deg, rgba(111,207,151,0.15), rgba(111,207,151,0.02))'
              : 'linear-gradient(90deg, rgba(255,90,78,0.18), rgba(255,90,78,0.02))',
            borderLeft: '3px solid ' + (prov.filed ? 'var(--green)' : 'var(--red)'),
            padding: 20,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="kicker" style={{ color: prov.filed ? 'var(--green)' : 'var(--red)' }}>
                  Priority 0 · THIS WEEK
                </span>
                <span className="kicker ink-3">· Single binary decision</span>
              </div>
              <div className="display-serif text-3xl ink-0">
                Did the fourth provisional ($65) get filed?
              </div>
              <div className="text-sm ink-2 mt-2" style={{ maxWidth: 700 }}>
                Binary. Urgent. Not reversible past April 22. Every other decision can wait. This one cannot.
                If not filed, Juan authorizes CPC to file tomorrow morning with drop-everything priority. USPTO receipt confirms resolution.
              </div>
            </div>
            {prov.filed ? <span className="stamp c-green">FILED</span> : <span className="stamp c-red blink">URGENT</span>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex items-center" style={{ border: '1px solid var(--line)' }}>
              <button
                onClick={() => setData(p => ({ ...p, provisional: { ...p.provisional, filed: true } }))}
                className="flex-1"
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  background: prov.filed ? 'var(--green)' : 'transparent',
                  color: prov.filed ? 'var(--bg-0)' : 'var(--ink-3)',
                  border: 'none',
                  borderRight: '1px solid var(--line)',
                  fontWeight: prov.filed ? 600 : 400,
                }}
              >✓ Filed</button>
              <button
                onClick={() => setData(p => ({ ...p, provisional: { ...p.provisional, filed: false } }))}
                className="flex-1"
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  background: !prov.filed ? 'var(--red)' : 'transparent',
                  color: !prov.filed ? 'var(--bg-0)' : 'var(--ink-3)',
                  border: 'none',
                  fontWeight: !prov.filed ? 600 : 400,
                }}
              >✕ Not filed</button>
            </div>
            <input
              placeholder="USPTO receipt #"
              value={prov.receipt}
              onChange={e => setData(p => ({ ...p, provisional: { ...p.provisional, receipt: e.target.value } }))}
            />
            <input
              type="date"
              value={prov.filedDate}
              onChange={e => setData(p => ({ ...p, provisional: { ...p.provisional, filedDate: e.target.value } }))}
            />
          </div>
        </div>
      </Panel>

      <div className="flex items-baseline gap-3 pt-2">
        <Kicker accent>Section 0</Kicker>
        <div className="text-sm ink-1">Three Contradictions to Resolve</div>
        <span className="kicker ink-3">— binding once chosen</span>
      </div>

      {SEED_DECISIONS.map((d, i) => {
        const state = data.decisions[d.id]
        return (
          <Panel key={d.id} corners bodyClass="p-0">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <Kicker>Decision {String(i + 1).padStart(2, '0')}</Kicker>
                  <div className="display-serif text-xl ink-0">{d.question}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip kind="amber">{d.urgency}</Chip>
                  {state?.choice && <Chip kind="green">resolved · {state.choice}</Chip>}
                </div>
              </div>
              <div className="text-xs ink-2 mt-2">{d.context}</div>
            </div>
            <div>
              {d.options.map((o: SeedDecisionOption) => {
                const selected = state?.choice === o.key
                return (
                  <label
                    key={o.key}
                    className="cursor-pointer"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 150px 1fr auto',
                      alignItems: 'start',
                      gap: 16,
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--line)',
                      background: selected ? 'rgba(247,183,51,0.06)' : 'transparent',
                      borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    <input
                      type="radio"
                      name={d.id}
                      checked={!!selected}
                      onChange={() => setData(p => ({
                        ...p,
                        decisions: { ...p.decisions, [d.id]: { choice: o.key, resolvedAt: new Date().toISOString() } },
                      }))}
                      style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <div className={'num text-lg ' + (selected ? 'c-accent' : 'ink-0')}>{o.key}</div>
                      <div className={'text-xs ' + (selected ? 'c-accent' : 'ink-1')} style={{ fontWeight: 500 }}>
                        {o.label.replace(/Option \d+ — /, '')}
                      </div>
                    </div>
                    <div className="text-xs ink-2 leading-snug">{o.detail}</div>
                    <div>{o.recommended && <Chip kind="solid">REC</Chip>}</div>
                  </label>
                )
              })}
              {state?.resolvedAt && (
                <div className="flex items-center justify-between px-4 py-2 text-xs ink-3" style={{ background: 'var(--bg-2)' }}>
                  <span className="kicker">Resolved {fmtDateTime(state.resolvedAt)} · Choice {state.choice}</span>
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => setData(p => ({
                      ...p,
                      decisions: { ...p.decisions, [d.id]: { choice: '', resolvedAt: null } },
                    }))}
                  >Reopen</button>
                </div>
              )}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
