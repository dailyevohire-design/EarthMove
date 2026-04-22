'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { DashboardState, SeedTask, TaskState } from '../types'
import { SEED_TASKS } from '../seed'
import {
  Panel, Kicker, Chip, StatusDot, StatusPill, Bar,
  fmtUSD, fmtDateTime,
} from './primitives'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

export default function SprintTab({
  data, setData,
}: {
  data: DashboardState
  setData: Dispatch<SetStateAction<DashboardState>> | ((u: Updater) => void)
}) {
  const [filterWs, setFilterWs] = useState<string>('all')
  const [filterTier, setFilterTier] = useState<string>('all')
  const [query, setQuery] = useState<string>('')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => new Set([1, 2, 3, 4]))
  const [highlightedTask, setHighlightedTask] = useState<string | null>(null)

  const workstreams = useMemo<string[]>(() => {
    const set = new Set(SEED_TASKS.map(t => t.workstream))
    return Array.from(set).sort()
  }, [])

  const filtered = useMemo<readonly SeedTask[]>(() => {
    return SEED_TASKS.filter(t => {
      if (filterWs !== 'all' && t.workstream !== filterWs) return false
      if (filterTier !== 'all' && t.tier !== Number(filterTier)) return false
      if (query && !(t.title + t.owner + t.workstream).toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [filterWs, filterTier, query])

  const weeks = useMemo(() => {
    const m = new Map<number, { label: string; range: string; tMinus: string; tasks: SeedTask[] }>()
    for (const t of filtered) {
      if (!m.has(t.week)) m.set(t.week, { label: t.weekLabel, range: t.weekRange, tMinus: t.tMinus, tasks: [] })
      m.get(t.week)!.tasks.push(t)
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [filtered])

  const weekKeys = useMemo<number[]>(() => {
    const all = Array.from(new Set(SEED_TASKS.map(t => t.week))).sort((a, b) => a - b)
    return all
  }, [])

  const weekXs = useMemo<Record<number, number>>(() => {
    const m: Record<number, number> = {}
    weekKeys.forEach((w, i) => { m[w] = i })
    return m
  }, [weekKeys])

  const gRows = useMemo(() => {
    const byWs: Record<string, SeedTask[]> = {}
    for (const t of filtered) {
      if (!byWs[t.workstream]) byWs[t.workstream] = []
      byWs[t.workstream]!.push(t)
    }
    return Object.entries(byWs).map(([ws, ts]) => ({ ws, tasks: ts }))
  }, [filtered])

  const launchIdx = weekKeys.indexOf(4)
  const launchX = (launchIdx / weekKeys.length) * 100
  const todayIdx = 0
  const todayX = ((todayIdx + 0.15) / weekKeys.length) * 100

  const toggleWeek = (w: number) => {
    setExpandedWeeks(prev => {
      const n = new Set(prev)
      if (n.has(w)) n.delete(w); else n.add(w)
      return n
    })
  }

  const doneCount = filtered.filter(t => data.tasks[t.id]?.status === 'Done').length

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-3">
        <Panel corners bodyClass="p-3">
          <Kicker>Tasks</Kicker>
          <div className="num text-2xl ink-0 mt-1">
            {doneCount}<span className="ink-4 text-base"> / {filtered.length}</span>
          </div>
          <div className="mt-1"><Bar pct={(doneCount / Math.max(1, filtered.length)) * 100} color="var(--green)" /></div>
        </Panel>
        <Panel corners bodyClass="p-3">
          <Kicker>In Flight</Kicker>
          <div className="num text-2xl c-amber mt-1">{filtered.filter(t => data.tasks[t.id]?.status === 'In Progress').length}</div>
          <div className="kicker mt-1 ink-3">of {filtered.length}</div>
        </Panel>
        <Panel corners bodyClass="p-3">
          <Kicker>Blocked</Kicker>
          <div className="num text-2xl c-red mt-1">{filtered.filter(t => data.tasks[t.id]?.status === 'Blocked').length}</div>
          <div className="kicker mt-1 ink-3">needs escalation</div>
        </Panel>
        <Panel corners bodyClass="p-3">
          <Kicker>Planned Spend</Kicker>
          <div className="num text-2xl ink-0 mt-1">{fmtUSD(filtered.reduce((s, t) => s + t.spend, 0))}</div>
          <div className="kicker mt-1 ink-3">across {weeks.length} weeks</div>
        </Panel>
      </div>

      {/* Gantt */}
      <Panel
        title="Sprint Timeline · Workstream Gantt"
        kicker="[01]"
        corners
        right={
          <div className="flex items-center gap-2 text-xs ink-3">
            <span className="flex items-center gap-1"><span className="dot" style={{ background: 'var(--amber)' }} /> Tier 1</span>
            <span className="flex items-center gap-1"><span className="dot" style={{ background: 'var(--blue)' }} /> Tier 2</span>
            <span className="flex items-center gap-1"><span className="dot" style={{ background: 'var(--ink-4)' }} /> Tier 3</span>
            <span className="ink-4">·</span>
            <span className="flex items-center gap-1"><span style={{ width: 10, height: 2, background: 'var(--accent)' }} /> today</span>
            <span className="flex items-center gap-1"><span style={{ width: 10, height: 2, background: 'var(--red)' }} /> launch</span>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 6 }}>
          <div className="kicker">Workstream</div>
          <div className="week-bar">
            {weekKeys.map((w, i) => (
              <div
                key={w}
                className={'week-seg' + (w === 1 ? ' active' : '') + (w === 4 ? ' active' : '')}
                style={{ left: (i / weekKeys.length) * 100 + '%', width: (1 / weekKeys.length) * 100 + '%' }}
              >
                W{w}
              </div>
            ))}
            <div className="today-line" style={{ left: todayX + '%' }} />
            <div className="launch-line" style={{ left: launchX + '%' }}>
              <div style={{ position: 'absolute', top: -14, left: -24, fontSize: 9, color: 'var(--red)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>LAUNCH ▾</div>
            </div>
          </div>
        </div>
        <div>
          {gRows.map(({ ws, tasks }) => (
            <div key={ws} className="gantt-row">
              <div className="text-xs ink-1 truncate" title={ws}>{ws}</div>
              <div className="gantt-track">
                {tasks.map(t => {
                  const idx = weekXs[t.week] ?? 0
                  const left = (idx / weekKeys.length) * 100
                  const width = (1 / weekKeys.length) * 100 - 0.5
                  const s = data.tasks[t.id]?.status
                  const cls = s === 'Done' ? 'done' : s === 'Blocked' ? 'blocked' : s === 'In Progress' ? 'inprog' : ('tier-' + t.tier)
                  const active = highlightedTask === t.id
                  return (
                    <div
                      key={t.id}
                      className={'gantt-bar ' + cls}
                      style={{
                        left: left + '%',
                        width: width + '%',
                        outline: active ? '1px solid var(--ink-0)' : 'none',
                        outlineOffset: 1,
                      }}
                      title={t.title}
                      onMouseEnter={() => setHighlightedTask(t.id)}
                      onMouseLeave={() => setHighlightedTask(null)}
                      onClick={() => {
                        if (!expandedWeeks.has(t.week)) {
                          const next = new Set(expandedWeeks)
                          next.add(t.week)
                          setExpandedWeeks(next)
                        }
                        setTimeout(() => {
                          const el = document.getElementById('task-' + t.id)
                          if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
                        }, 50)
                      }}
                    >
                      {t.owner}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Filters */}
      <div className="panel flex items-center gap-3 p-3" style={{ flexWrap: 'wrap' }}>
        <div className="flex items-center gap-2 flex-1" style={{ minWidth: 200 }}>
          <span className="kicker shrink-0">Search</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="title / owner / workstream…" style={{ flex: 1 }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="kicker">Workstream</span>
          <select value={filterWs} onChange={e => setFilterWs(e.target.value)}>
            <option value="all">all · {workstreams.length}</option>
            {workstreams.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="kicker">Tier</span>
          <select value={filterTier} onChange={e => setFilterTier(e.target.value)}>
            <option value="all">all</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={() => setExpandedWeeks(new Set(weekKeys))}>Expand all</button>
          <button className="btn btn-ghost text-xs" onClick={() => setExpandedWeeks(new Set())}>Collapse</button>
        </div>
      </div>

      {/* Weekly task cards */}
      <div className="space-y-3">
        {weeks.map(([wk, info]) => {
          const open = expandedWeeks.has(wk)
          const done = info.tasks.filter(t => data.tasks[t.id]?.status === 'Done').length
          const blocked = info.tasks.filter(t => data.tasks[t.id]?.status === 'Blocked').length
          const inprog = info.tasks.filter(t => data.tasks[t.id]?.status === 'In Progress').length
          const spend = info.tasks.reduce((s, t) => s + t.spend, 0)
          const isLaunch = wk === 4
          return (
            <div
              key={wk}
              className={'panel corners' + (isLaunch ? ' relative' : '')}
              style={isLaunch ? { borderColor: 'var(--red-dim)', background: 'linear-gradient(180deg, rgba(255,90,78,0.04) 0%, transparent 100%)' } : undefined}
            >
              <span className="c-br" />
              <button
                onClick={() => toggleWeek(wk)}
                className="w-full flex items-center gap-4"
                style={{ padding: 14, background: 'transparent', border: 'none', textAlign: 'left' }}
              >
                <span className="ink-3">{open ? '▾' : '▸'}</span>
                <div className="flex items-baseline gap-3 flex-1 min-w-0">
                  <span className="kicker ink-4">W{String(wk).padStart(2, '0')}</span>
                  <span className={'display-serif text-2xl ' + (isLaunch ? 'c-red' : 'ink-0')}>{info.label}</span>
                  <span className="kicker">{info.range} · {info.tMinus}</span>
                  {isLaunch && <span className="chip chip-red">LAUNCH</span>}
                </div>
                <div className="flex items-center gap-4 text-xs ink-2">
                  <span><span className="c-green num">{done}</span> done</span>
                  {inprog > 0 && <span><span className="c-amber num">{inprog}</span> in flight</span>}
                  {blocked > 0 && <span><span className="c-red num">{blocked}</span> blocked</span>}
                  <span className="ink-3">· {info.tasks.length} total</span>
                  {spend > 0 && <span className="num ink-1">{fmtUSD(spend)}</span>}
                </div>
              </button>
              {open && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  {info.tasks.map(t => (
                    <TaskDetailRow
                      key={t.id}
                      task={t}
                      state={data.tasks[t.id]}
                      highlighted={highlightedTask === t.id}
                      onChange={patch => setData((prev: DashboardState) => ({
                        ...prev,
                        tasks: {
                          ...prev.tasks,
                          [t.id]: {
                            status: prev.tasks[t.id]?.status ?? 'Not Started',
                            notes: prev.tasks[t.id]?.notes ?? '',
                            updatedAt: new Date().toISOString(),
                            ...patch,
                          },
                        },
                      }))}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskDetailRow({
  task, state, onChange, highlighted,
}: {
  task: SeedTask
  state: TaskState | undefined
  onChange: (patch: Partial<TaskState>) => void
  highlighted: boolean
}) {
  const [open, setOpen] = useState<boolean>(false)
  const s = state?.status ?? 'Not Started'
  return (
    <div
      id={'task-' + task.id}
      className="task-row"
      style={{
        gridTemplateColumns: '20px auto 1fr auto auto',
        display: 'grid',
        alignItems: 'start',
        background: highlighted ? 'var(--bg-2)' : undefined,
        transition: 'background 0.2s',
      }}
    >
      <StatusDot status={s} />
      <Chip kind={task.tier === 1 ? 'amber' : task.tier === 2 ? 'blue' : 'default'}>
        T{task.tier}
      </Chip>
      <div className="min-w-0">
        <div className="text-sm ink-1 leading-snug">{task.title}</div>
        <div className="flex items-center gap-3 text-xs ink-3 mt-1" style={{ flexWrap: 'wrap' }}>
          <span className="c-amber">{task.workstream}</span>
          <span>· {task.owner}</span>
          {task.spend > 0 && <span>· {fmtUSD(task.spend)}</span>}
          {state?.updatedAt && <span>· updated {fmtDateTime(state.updatedAt)}</span>}
        </div>
        {open && (
          <div className="mt-3 space-y-3" style={{ paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Kicker>Exit criterion</Kicker>
                <div className="text-xs ink-1 mt-1">{task.exit}</div>
              </div>
              <div>
                <Kicker>Kill criterion</Kicker>
                <div className="text-xs ink-1 mt-1">{task.kill}</div>
              </div>
            </div>
            <div>
              <Kicker>Operator notes</Kicker>
              <textarea
                value={state?.notes ?? ''}
                onChange={e => onChange({ notes: e.target.value })}
                placeholder="blockers · links · decisions…"
                className="w-full mt-1"
                style={{ minHeight: 60 }}
              />
            </div>
          </div>
        )}
      </div>
      <StatusPill status={s} onChange={v => onChange({ status: v })} />
      <button className="btn btn-ghost text-xs" style={{ padding: '4px 8px' }} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Detail'}
      </button>
    </div>
  )
}
