import { RouteMap } from './RouteMap'

const trucks = [
  { id: 'EM-DEMO-1', desc: 'Class 5 base · 14t', from: 'YARD-23 → SITE-A', stage: 'transit' as const, eta: '11:42' },
  { id: 'EM-DEMO-2', desc: '¾″ Washed · 8t', from: 'YARD-21 → SITE-B', stage: 'loading' as const, eta: '12:15' },
  { id: 'EM-DEMO-3', desc: 'Topsoil · 6t', from: 'YARD-22 → SITE-C', stage: 'drop' as const, eta: 'Now' },
]

const stageLabel: Record<typeof trucks[number]['stage'], string> = {
  transit: 'In transit',
  loading: 'Loading',
  drop: 'Drop',
}

export function Dispatch() {
  return (
    <section className="v3-tele">
      <div className="v3-tele-head">
        <div className="l">
          <span className="dot" /> Dispatch · Sample
        </div>
        <div className="r">3 active · DEN-METRO</div>
      </div>
      <RouteMap />
      <div className="v3-tele-list">
        {trucks.map((t) => (
          <div key={t.id} className={'v3-tele-row' + (t.stage === 'transit' ? ' active' : '')}>
            <span className="id">{t.id}</span>
            <span className="desc">{t.desc}<small>{t.from}</small></span>
            <span className={'stage s-' + t.stage}>{stageLabel[t.stage]}</span>
            <span className="eta">{t.eta}</span>
          </div>
        ))}
      </div>
      <div className="v3-tele-foot">
        <span><span className="live">●</span> Sample view · illustrates dispatch flow</span>
        <span>GPS · photo on drop</span>
      </div>
    </section>
  )
}
