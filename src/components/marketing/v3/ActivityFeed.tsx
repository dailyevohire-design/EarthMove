'use client'

import { useEffect, useState } from 'react'

const PLACES = ['DEN-80211', 'DEN-80216', 'DFW-75201', 'DEN-80020', 'DFW-75019', 'DEN-80303', 'AURORA-80012', 'GOLDEN-80401']
const MATS = ['Class 5 · 14t', '¾″ Washed · 8t', 'Topsoil · 6t', 'Pea gravel · 4t', 'Backfill · 22t', 'Road base · 16t']
const TAGS = ['q', 'd', 'x'] as const
const TAG_LBL: Record<typeof TAGS[number], string> = { q: 'Quoted', d: 'Dispatched', x: 'Delivered' }

interface Item {
  id: number
  tag: typeof TAGS[number]
  loc: string
  mat: string
  when: string
}

export function ActivityFeed() {
  const [items, setItems] = useState<Item[]>(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: 4521 - i,
      tag: TAGS[i % 3],
      loc: PLACES[i % PLACES.length],
      mat: MATS[i % MATS.length],
      when: i === 0 ? '12s' : `${Math.floor(i * 25)}s`,
    })),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setItems((prev) => {
        const newRow: Item = {
          id: prev[0].id + 1,
          tag: TAGS[Math.floor(Math.random() * 3)],
          loc: PLACES[Math.floor(Math.random() * PLACES.length)],
          mat: MATS[Math.floor(Math.random() * MATS.length)],
          when: 'now',
        }
        const aged = prev.map((r, i) => ({ ...r, when: `${(i + 1) * 22}s` }))
        return [newRow, ...aged].slice(0, 6)
      })
    }, 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="v3-feed">
      <div className="v3-feed-head">
        <span>Sample activity · illustrative</span>
        <span className="live"><span className="dot" /> Streaming</span>
      </div>
      {items.map((it) => (
        <div key={it.id} className="v3-feed-row">
          <span className="when">{it.when} ago</span>
          <span className={'tag ' + it.tag}>{TAG_LBL[it.tag]}</span>
          <span className="id">EM-{it.id}</span>
          <span className="loc">{it.loc} · {it.mat}</span>
        </div>
      ))}
    </section>
  )
}
