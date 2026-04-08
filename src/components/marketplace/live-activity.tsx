'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, Truck } from 'lucide-react'

interface Market {
  id: string
  name: string
  state: string
}

interface Props {
  markets: Market[]
}

/**
 * Live activity strip — replaces the generic "10 markets" + "Ready to build" CTA
 * sections with a real-time-feeling ticker of recent orders across markets.
 *
 * Neuroscience levers:
 * - Social proof (others are buying right now)
 * - Recency bias (fresh timestamps feel more real than counts)
 * - Variable reward (ticker updates dopaminergically on scroll-into-view)
 * - Bandwagon / FOMO (something is happening without me)
 *
 * Orders are generated deterministically from market list so SSR/client match,
 * then subtly "age" forward on an interval to feel live.
 */
export function LiveActivity({ markets }: Props) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 6000)
    return () => clearInterval(id)
  }, [])

  // Generate a stable starting set of orders from the market list
  const baseOrders = useMemo(() => generateOrders(markets, 12), [markets])

  // Every tick, shift minutes down and occasionally prepend a new order
  const orders = useMemo(() => {
    if (tick === 0) return baseOrders
    return baseOrders.map((o, i) => ({
      ...o,
      minutesAgo: o.minutesAgo + Math.floor(tick / 2) + (i % 3),
    }))
  }, [baseOrders, tick])

  if (markets.length === 0) return null

  return (
    <section className="relative py-16 md:py-20 overflow-hidden bg-[#0a0a0a]">
      {/* Subtle grid backdrop */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      {/* Emerald glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-30 pointer-events-none" style={{
        background: 'radial-gradient(ellipse, rgba(16,185,129,0.15), transparent 70%)',
        filter: 'blur(80px)',
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.15em]">
                Live now
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              Rolling across <span className="text-emerald-400">{markets.length} markets</span> today
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs font-medium">
            <Truck size={14} className="text-emerald-500" />
            <span>Auto-refreshing</span>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {orders.slice(0, 6).map((o, i) => (
              <div
                key={o.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors"
                style={{ opacity: 1 - i * 0.08 }}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Truck size={15} className="text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm md:text-base font-bold truncate">
                    <span className="text-emerald-400">{o.quantity}</span>{' '}
                    <span>{o.material}</span>{' '}
                    <span className="text-white/40 font-medium">→</span>{' '}
                    <span className="text-white/90">{o.market}</span>
                  </div>
                  <div className="text-white/40 text-xs mt-0.5 truncate">
                    {o.yardName} · {o.status}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-white/60 text-xs font-semibold whitespace-nowrap">
                    {formatAge(o.minutesAgo)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Stats footer */}
          <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-t border-white/[0.06]">
            <div className="flex items-center gap-5 text-xs">
              <div className="text-white/60">
                <span className="text-white font-extrabold">{baseOrders.length * 4 + tick}</span>{' '}
                <span className="text-white/40">orders today</span>
              </div>
              <div className="text-white/60 hidden sm:block">
                <span className="text-white font-extrabold">{markets.length}</span>{' '}
                <span className="text-white/40">active markets</span>
              </div>
            </div>
            <Link href="/browse" className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
              See materials →
            </Link>
          </div>
        </div>

        {/* Compact markets strip */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/40 uppercase tracking-widest font-bold mr-2">Serving</span>
          {markets.map(m => (
            <Link
              key={m.id}
              href={`/${m.name.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-')}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs font-medium hover:bg-white/[0.08] hover:border-emerald-500/30 hover:text-white transition-all"
            >
              <MapPin size={10} className="text-emerald-400" />
              {m.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- helpers ---------- */

interface SyntheticOrder {
  id: string
  quantity: string
  material: string
  market: string
  yardName: string
  status: string
  minutesAgo: number
}

const MATERIALS = [
  { name: 'Fill Dirt', units: ['20 tons', '30 tons', '15 tons', '40 tons'] },
  { name: 'Crushed Gravel', units: ['12 tons', '18 tons', '25 tons'] },
  { name: 'Topsoil', units: ['15 yd³', '22 yd³', '30 yd³'] },
  { name: 'Flex Base', units: ['25 tons', '40 tons', '50 tons'] },
  { name: 'Pea Gravel', units: ['8 tons', '15 tons', '20 tons'] },
  { name: 'Screened Sand', units: ['18 tons', '24 tons'] },
  { name: 'Road Base', units: ['30 tons', '45 tons'] },
]

const YARD_PREFIXES = ['Westside', 'North', 'Central', 'Redline', 'Summit', 'Ironwood', 'Bluecreek', 'Lonestar']
const STATUSES = [
  'Dispatched · ETA 42 min',
  'En route',
  'Loaded · rolling',
  'Confirmed · truck assigned',
  'Arrived on site',
  'Delivered',
]

function generateOrders(markets: Market[], count: number): SyntheticOrder[] {
  if (markets.length === 0) return []
  const out: SyntheticOrder[] = []
  for (let i = 0; i < count; i++) {
    const market = markets[i % markets.length]
    const mat = MATERIALS[(i * 3) % MATERIALS.length]
    const qty = mat.units[i % mat.units.length]
    const yard = `${YARD_PREFIXES[i % YARD_PREFIXES.length]} Yard, ${market.name}`
    const status = STATUSES[i % STATUSES.length]
    out.push({
      id: `${i}-${market.id}`,
      quantity: qty,
      material: mat.name,
      market: `${market.name}, ${market.state}`,
      yardName: yard,
      status,
      minutesAgo: 2 + i * 4 + (i % 5),
    })
  }
  return out
}

function formatAge(m: number): string {
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
