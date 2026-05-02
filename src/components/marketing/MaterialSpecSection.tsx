// src/components/marketing/MaterialSpecSection.tsx
import { getMaterialImage } from '@/lib/material-images'

const SPEC_CARDS = [
  {
    slug: 'flex-base',
    name: 'Flex Base',
    grade: 'Class 1',
    specs: [
      { label: 'Gradation',   value: '0.75″',   unit: 'minus' },
      { label: 'Compaction',  value: '95%',     unit: 'target' },
      { label: 'Density',     value: '1.45',    unit: 't/yd³' },
      { label: 'Common use',  value: 'Road base · driveway pad' },
    ],
  },
  {
    slug: 'concrete-sand',
    name: 'Concrete Sand',
    grade: 'ASTM C33',
    specs: [
      { label: 'Wash',          value: 'Washed', unit: 'low fines' },
      { label: 'Fineness mod',  value: '2.3 – 3.1' },
      { label: 'Particle size', value: '≤ 4.75', unit: 'mm' },
      { label: 'Common use',    value: 'Mortar · concrete · bedding' },
    ],
  },
  {
    slug: 'base-gravel-57',
    name: '#57 Drainage Rock',
    grade: 'Angular',
    specs: [
      { label: 'Size',       value: '1″ – 0.5″' },
      { label: 'Shape',      value: 'Angular' },
      { label: 'Fines',      value: 'Low',    unit: 'drains free' },
      { label: 'Common use', value: 'French drains · footings' },
    ],
  },
]

export function MaterialSpecSection() {
  return (
    <section id="spec" className="ms-section">
      <div className="ms-container">
        <div className="ms-eyebrow">— Material intelligence</div>
        <h2 className="ms-h2">
          Every load matched to the spec your crew{' '}
          <span className="ms-h2-em">actually needs.</span>
        </h2>
        <div className="ms-grid">
          {SPEC_CARDS.map((card) => (
            <article key={card.slug} className="ms-card">
              <div
                className="ms-card-image"
                style={{ backgroundImage: `url(${getMaterialImage(card.slug)})` }}
                role="img"
                aria-label={card.name}
              />
              <div className="ms-card-body">
                <div className="ms-card-name">{card.name}</div>
                <div className="ms-card-grade">{card.grade}</div>
                <dl className="ms-card-specs">
                  {card.specs.map((s) => (
                    <div key={s.label} className="ms-card-spec">
                      <dt className="ms-card-spec-l">{s.label}</dt>
                      <dd className="ms-card-spec-v">
                        {s.value}
                        {s.unit && <small> {s.unit}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
