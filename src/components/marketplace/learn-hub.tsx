'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getArticleImage } from '@/lib/material-images'
import {
  ArrowRight, Calculator, Leaf, HardHat, Home,
  Grid3X3, Clock, TrendingUp, Zap,
} from 'lucide-react'

/* ─── ARTICLES DATA ─── */
const ARTICLES = [
  { slug: 'driveway-gravel-guide', title: 'The Complete Guide to Driveway Gravel in 2025', desc: 'Everything about choosing, calculating, and installing driveway materials.', time: '12 min', cat: 'Homeowner', featured: true },
  { slug: 'fill-dirt-vs-topsoil', title: 'Fill Dirt vs Topsoil: Which One Do You Actually Need?', desc: 'The difference could save you thousands on your next project.', time: '8 min', cat: 'Homeowner', featured: true },
  { slug: 'french-drain-materials', title: 'Best Materials for French Drains', desc: 'Stop water damage before it starts. Complete drainage guide.', time: '10 min', cat: 'Homeowner', featured: false },
  { slug: 'how-much-gravel-do-i-need', title: 'How Much Gravel Do I Need?', desc: 'Never over-order or under-order again.', time: '6 min', cat: 'Calculator', featured: false },
  { slug: 'spring-project-guide-2025', title: '2025 Spring Project Guide', desc: 'Beat the price increases. Seasonal planning guide.', time: '9 min', cat: 'Seasonal', featured: false },
  { slug: 'gravel-calculator', title: 'Free Gravel & Aggregate Calculator', desc: 'Calculate cubic yards, tons, and truckloads instantly.', time: '2 min', cat: 'Calculator', featured: false },
  { slug: 'material-grades-explained', title: 'Aggregate Grades Explained', desc: '#57, #67, Grade 1 flex base — decoded for contractors.', time: '7 min', cat: 'Contractor', featured: false },
  { slug: 'ordering-wrong-material', title: 'The $3,000 Mistake', desc: 'Real stories of costly material mistakes and how to avoid them.', time: '8 min', cat: 'Homeowner', featured: false },
]

const FILTERS = [
  { key: 'all', label: 'All', icon: Grid3X3 },
  { key: 'Homeowner', label: 'Homeowner', icon: Home },
  { key: 'Contractor', label: 'Contractor', icon: HardHat },
  { key: 'Calculator', label: 'Calculators', icon: Calculator },
  { key: 'Seasonal', label: 'Seasonal', icon: Leaf },
]

const PROJECTS = [
  { num: '01', name: 'Driveway', desc: 'Most ordered project type nationwide', accent: '#f59e0b', materials: [{ name: 'Flex Base', price: 'from $24/ton' }, { name: 'Road Base', price: 'from $16/ton' }, { name: 'Pea Gravel', price: 'from $35/ton' }], icon: 'M4 20 L12 4 L20 20 M4 20 L20 20' },
  { num: '02', name: 'Landscaping', desc: 'Transform any outdoor space', accent: '#10b981', materials: [{ name: 'Topsoil', price: 'from $45/yd' }, { name: 'River Rock', price: 'from $42/ton' }, { name: 'Decomposed Granite', price: 'from $38/ton' }], icon: 'M12 3 C12 3 5 10 5 14 C5 18 9 22 12 22 C15 22 19 18 19 14 C19 10 12 3 12 3' },
  { num: '03', name: 'French Drain', desc: 'Stop water damage permanently', accent: '#3b82f6', materials: [{ name: 'Pea Gravel', price: 'from $35/ton' }, { name: 'Base Gravel #57', price: 'from $28/ton' }, { name: 'River Rock', price: 'from $42/ton' }], icon: 'M6 4 L6 14 C6 18 12 20 12 20 C12 20 18 18 18 14 L18 4 M3 8 L21 8 M3 12 L21 12' },
  { num: '04', name: 'Pad Prep', desc: 'Build a solid foundation first', accent: '#8b5cf6', materials: [{ name: 'Flex Base', price: 'from $24/ton' }, { name: 'Fill Dirt', price: 'from $12/ton' }, { name: 'Road Base', price: 'from $16/ton' }], icon: 'M3 3 L21 3 L21 21 L3 21 Z M3 9 L21 9 M3 15 L21 15 M9 3 L9 21 M15 3 L15 21' },
  { num: '05', name: 'Pool Backfill', desc: 'Fill right, avoid settling', accent: '#06b6d4', materials: [{ name: 'Select Fill', price: 'from $18/ton' }, { name: 'Concrete Sand', price: 'from $19/ton' }, { name: 'Pea Gravel', price: 'from $35/ton' }], icon: 'M4 8 C4 8 8 4 12 4 C16 4 20 8 20 8 L20 16 C20 16 16 20 12 20 C8 20 4 16 4 16 Z M6 10 C8 8 16 8 18 10' },
  { num: '06', name: 'Garden Beds', desc: 'Rich soil for healthy growth', accent: '#84cc16', materials: [{ name: 'Topsoil', price: 'from $45/yd' }, { name: 'Masonry Sand', price: 'from $22/ton' }, { name: 'Pea Gravel', price: 'from $35/ton' }], icon: 'M12 22 L12 12 M8 18 L12 12 L16 18 M7 22 L17 22 M9 12 C9 8 6 6 6 4 M15 12 C15 8 18 6 18 4 M12 12 C12 8 12 6 12 2' },
  { num: '07', name: 'Road Work', desc: 'Built to handle heavy traffic', accent: '#ef4444', materials: [{ name: 'Road Base', price: 'from $16/ton' }, { name: 'Flex Base', price: 'from $24/ton' }, { name: 'Crushed Concrete', price: 'from $14/ton' }], icon: 'M4 4 L10 4 L10 20 L4 20 M14 4 L20 4 L20 20 L14 20 M10 8 L14 8 M10 12 L14 12 M10 16 L14 16' },
  { num: '08', name: 'Yard Leveling', desc: 'Grade and flatten any surface', accent: '#f97316', materials: [{ name: 'Fill Dirt', price: 'from $12/ton' }, { name: 'Topsoil', price: 'from $45/yd' }, { name: 'Select Fill', price: 'from $18/ton' }], icon: 'M2 16 L22 16 M2 12 L6 12 L10 8 L14 12 L22 12 M6 16 L6 12 M18 16 L18 12' },
]

const CITY_PRICES: Record<string, Array<{ mat: string; price: string; trend: string; trendDir: 'up' | 'down' | 'flat'; vsAvg: string }>> = {
  'Dallas': [
    { mat: 'Fill Dirt', price: '$12.00/ton', trend: '↑ 3%', trendDir: 'up', vsAvg: '-8% below' },
    { mat: 'Flex Base', price: '$24.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: 'At avg' },
    { mat: 'Topsoil', price: '$45.00/yd', trend: '↑ 5%', trendDir: 'up', vsAvg: '+2% above' },
    { mat: 'Pea Gravel', price: '$35.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: '-3% below' },
    { mat: 'Road Base', price: '$16.00/ton', trend: '↑ 2%', trendDir: 'up', vsAvg: 'At avg' },
    { mat: 'River Rock', price: '$42.00/ton', trend: '↓ 1%', trendDir: 'down', vsAvg: '+5% above' },
  ],
  'Houston': [
    { mat: 'Fill Dirt', price: '$10.50/ton', trend: '↑ 4%', trendDir: 'up', vsAvg: '-15% below' },
    { mat: 'Flex Base', price: '$22.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: '-5% below' },
    { mat: 'Topsoil', price: '$42.00/yd', trend: '↑ 6%', trendDir: 'up', vsAvg: '-4% below' },
    { mat: 'Pea Gravel', price: '$33.00/ton', trend: '↑ 2%', trendDir: 'up', vsAvg: '-8% below' },
    { mat: 'Road Base', price: '$14.50/ton', trend: '→ stable', trendDir: 'flat', vsAvg: '-7% below' },
    { mat: 'River Rock', price: '$40.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: 'At avg' },
  ],
  'Denver': [
    { mat: 'Fill Dirt', price: '$15.00/ton', trend: '↑ 8%', trendDir: 'up', vsAvg: '+12% above' },
    { mat: 'Flex Base', price: '$27.00/ton', trend: '↑ 3%', trendDir: 'up', vsAvg: '+8% above' },
    { mat: 'Topsoil', price: '$50.00/yd', trend: '↑ 10%', trendDir: 'up', vsAvg: '+14% above' },
    { mat: 'Pea Gravel', price: '$36.00/ton', trend: '↑ 4%', trendDir: 'up', vsAvg: 'At avg' },
    { mat: 'Road Base', price: '$17.00/ton', trend: '↑ 5%', trendDir: 'up', vsAvg: '+6% above' },
    { mat: 'River Rock', price: '$46.00/ton', trend: '↑ 2%', trendDir: 'up', vsAvg: '+10% above' },
  ],
  'Atlanta': [
    { mat: 'Fill Dirt', price: '$13.50/ton', trend: '→ stable', trendDir: 'flat', vsAvg: 'At avg' },
    { mat: 'Flex Base', price: '$25.00/ton', trend: '↑ 2%', trendDir: 'up', vsAvg: 'At avg' },
    { mat: 'Topsoil', price: '$46.00/yd', trend: '↑ 4%', trendDir: 'up', vsAvg: '+3% above' },
    { mat: 'Pea Gravel', price: '$34.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: '-5% below' },
    { mat: 'Road Base', price: '$16.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: 'At avg' },
    { mat: 'River Rock', price: '$44.00/ton', trend: '↑ 1%', trendDir: 'up', vsAvg: '+5% above' },
  ],
  'Phoenix': [
    { mat: 'Fill Dirt', price: '$14.00/ton', trend: '↑ 6%', trendDir: 'up', vsAvg: '+5% above' },
    { mat: 'Flex Base', price: '$28.00/ton', trend: '↑ 4%', trendDir: 'up', vsAvg: '+10% above' },
    { mat: 'Topsoil', price: '$52.00/yd', trend: '↑ 8%', trendDir: 'up', vsAvg: '+16% above' },
    { mat: 'Pea Gravel', price: '$38.00/ton', trend: '↑ 3%', trendDir: 'up', vsAvg: '+5% above' },
    { mat: 'Road Base', price: '$18.00/ton', trend: '↑ 5%', trendDir: 'up', vsAvg: '+10% above' },
    { mat: 'River Rock', price: '$48.00/ton', trend: '→ stable', trendDir: 'flat', vsAvg: '+15% above' },
  ],
}

const TIPS = [
  'Fill dirt costs 40% more if ordered in April vs March',
  'Always order 10% extra — second deliveries cost 2x',
  'One truckload ≈ 14 tons of fill dirt or gravel',
  'Flex base compacts 15-20% — factor that into calculations',
  'Topsoil and fill dirt are NOT interchangeable',
  'Pea gravel is the #1 material for French drains',
]

/* ─── COUNTER HOOK ─── */
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const t0 = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - t0) / duration, 1)
          setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return { count, ref }
}

/* ─── MAIN COMPONENT ─── */
export function LearnHub() {
  const [filter, setFilter] = useState('all')
  const [city, setCity] = useState('Dallas')
  const [tipIdx, setTipIdx] = useState(0)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  const weeklyLearners = useCountUp(847, 1500)

  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5000)
    return () => clearInterval(t)
  }, [])

  const filtered = filter === 'all' ? ARTICLES : ARTICLES.filter(a => a.cat === filter)
  const heroArticle = ARTICLES.find(a => a.featured) ?? ARTICLES[0]
  const sideArticles = ARTICLES.filter(a => a.featured && a.slug !== heroArticle.slug).slice(0, 2)
  const prices = CITY_PRICES[city] ?? CITY_PRICES['Dallas']

  return (
    <div style={{ background: '#f8f9fa' }}>
      {/* ═══ SECTION 1: HERO ═══ */}
      <section className="relative overflow-hidden min-h-[520px] flex flex-col justify-center">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2a1a 50%, #0d1117 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(16,185,129,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(245,158,11,0.06) 0%, transparent 50%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight" style={{ textShadow: '0 0 60px rgba(16,185,129,0.2)' }}>
              The EarthMove<br /><span className="text-emerald-400">Knowledge Center</span>
            </h1>
            <p className="text-lg mt-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Everything you need to know about aggregates. Built by industry experts.
            </p>
            {/* Live stat */}
            <div ref={weeklyLearners.ref} className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">{weeklyLearners.count} contractors learned something new this week</span>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: '🧮', title: 'Material Calculator', desc: 'Calculate exactly what you need', href: '/learn/gravel-calculator' },
              { icon: '🔍', title: 'Material Match', desc: 'Find your perfect material', href: '/material-match' },
              { icon: '📈', title: 'Price Intelligence', desc: 'Current prices across 10 cities', href: '#prices' },
            ].map(c => (
              <Link key={c.title} href={c.href} className="group p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
                <div className="text-3xl mb-3">{c.icon}</div>
                <div className="text-white font-bold text-sm">{c.title}</div>
                <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2: INTELLIGENCE DASHBOARD ═══ */}
      <section className="py-10" style={{ background: '#0d1117' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left: Season intel */}
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-emerald-400" />
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Season Intel</span>
              </div>
              <div className="text-white font-bold text-lg mb-1">Demand ↑ 34% this week</div>
              <div className="text-gray-500 text-xs mb-4">Spring ordering season has started</div>
              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-16">
                {[40, 55, 45, 60, 72, 68, 85, 92].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i >= 6 ? '#10b981' : 'rgba(255,255,255,0.08)', transition: 'height 1s ease' }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>8 weeks ago</span><span>This week</span>
              </div>
            </div>

            {/* Center: Season gauge */}
            <div className="p-5 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">Project Season Status</div>
              {/* SVG gauge */}
              <svg viewBox="0 0 120 70" className="w-40 mx-auto">
                <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
                <path d="M 10 65 A 50 50 0 0 1 85 20" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />
                <text x="60" y="55" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">67%</text>
                <text x="60" y="66" textAnchor="middle" fill="#6b7280" fontSize="7">Peak Season Active</text>
              </svg>
              <div className="mt-3 text-emerald-400 font-bold text-sm animate-pulse">Best time to order: NOW</div>
            </div>

            {/* Right: Rotating tips */}
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Quick Knowledge</span>
              </div>
              <div className="h-20 flex items-center">
                <p className="text-white text-sm font-medium leading-relaxed transition-opacity duration-500" key={tipIdx}>
                  "{TIPS[tipIdx]}"
                </p>
              </div>
              <div className="flex gap-1 mt-3">
                {TIPS.map((_, i) => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i === tipIdx ? '#f59e0b' : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: ARTICLES ═══ */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {FILTERS.map(f => {
              const Icon = f.icon
              const active = filter === f.key
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                  <Icon size={15} />
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Hero article + side articles */}
          {filter === 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-8">
              {/* Hero article */}
              <Link href={`/learn/${heroArticle.slug}`} className="lg:col-span-3 group block">
                <div className="rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 h-full">
                  <div className="relative h-64 md:h-80 overflow-hidden">
                    <img src={getArticleImage(heroArticle.slug)} alt={heroArticle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="eager" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold">{heroArticle.cat}</span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="px-3 py-1 rounded-lg bg-black/50 text-white text-xs font-medium flex items-center gap-1"><Clock size={10} /> {heroArticle.time}</span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white font-extrabold text-2xl leading-tight">{heroArticle.title}</h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-gray-500 text-sm line-clamp-2">{heroArticle.desc}</p>
                    <span className="inline-flex items-center gap-1 mt-3 text-emerald-600 text-sm font-bold group-hover:gap-2 transition-all">Read guide <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Link>

              {/* Side articles */}
              <div className="lg:col-span-2 flex flex-col gap-5">
                {sideArticles.map(a => (
                  <Link key={a.slug} href={`/learn/${a.slug}`} className="group block flex-1">
                    <div className="rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                      <div className="relative h-36 overflow-hidden">
                        <img src={getArticleImage(a.slug)} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold">{a.cat}</span>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-emerald-600 transition-colors">{a.title}</h3>
                        <span className="mt-auto pt-2 text-emerald-600 text-xs font-bold flex items-center gap-1">Read <ArrowRight size={12} /></span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Article grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(filter === 'all' ? ARTICLES.filter(a => !a.featured) : filtered).map(a => (
              <Link key={a.slug} href={`/learn/${a.slug}`} className="group block">
                <div className={`rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${a.cat === 'Calculator' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                  <div className="relative h-44 overflow-hidden">
                    <img src={getArticleImage(a.slug)} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        a.cat === 'Homeowner' ? 'bg-blue-500 text-white' :
                        a.cat === 'Contractor' ? 'bg-orange-500 text-white' :
                        a.cat === 'Calculator' ? 'bg-emerald-500 text-white' :
                        'bg-amber-500 text-white'
                      }`}>{a.cat}</span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">{a.time}</span>
                    </div>
                    {/* Hover read button */}
                    <div className="absolute inset-x-3 bottom-3 translate-y-12 group-hover:translate-y-0 transition-transform duration-300">
                      <div className="bg-emerald-600 text-white rounded-xl py-2 text-center text-xs font-bold">Read Now →</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className={`font-bold text-sm leading-snug line-clamp-2 ${a.cat === 'Calculator' ? 'text-white group-hover:text-emerald-400' : 'text-gray-900 group-hover:text-emerald-600'} transition-colors`}>{a.title}</h3>
                    <p className={`text-xs mt-2 line-clamp-2 ${a.cat === 'Calculator' ? 'text-gray-400' : 'text-gray-500'}`}>{a.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 4: PROJECT INTELLIGENCE ═══ */}
      {/* Divider */}
      <div className="flex items-center justify-center py-4" style={{ background: '#080c14' }}>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="w-2 h-2 rotate-45 mx-4" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <section style={{ background: '#080c14', padding: '80px 0 100px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="text-center mb-14">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: '#10b981' }}>Project Intelligence</span>
            <h2 className="text-3xl sm:text-4xl md:text-[48px] font-extrabold text-white mt-3 leading-tight">What are you building?</h2>
            <p className="text-lg mt-4 max-w-2xl mx-auto" style={{ color: '#9ca3af' }}>
              Select your project type for material recommendations, quantity estimates, and current pricing
            </p>
            <div className="w-[60px] h-[2px] mx-auto mt-6" style={{ background: '#10b981' }} />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px]">
            {PROJECTS.map(p => {
              const isOpen = hoveredProject === p.name
              return (
                <div
                  key={p.name}
                  onClick={() => setHoveredProject(isOpen ? null : p.name)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    background: isOpen ? '#111827' : '#0d1117',
                    border: `1px solid ${isOpen ? p.accent + '99' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    padding: 28,
                    transform: isOpen ? 'translateY(-3px)' : 'none',
                    boxShadow: isOpen ? `0 0 30px ${p.accent}14` : 'none',
                  }}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    {/* Icon box */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#1a2332', border: `1px solid ${isOpen ? p.accent : p.accent + '40'}`, transition: 'border-color 300ms' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={p.icon} />
                      </svg>
                    </div>
                    {/* Number */}
                    <span className="text-[72px] font-black leading-none select-none" style={{ color: 'rgba(255,255,255,0.03)' }}>{p.num}</span>
                  </div>

                  {/* Name + desc */}
                  <div className="text-white font-bold text-[17px] mb-1">{p.name}</div>
                  <div className="text-[13px] mb-3" style={{ color: '#6b7280' }}>{p.desc}</div>

                  {/* Explore link */}
                  <div className="text-[12px] font-medium transition-all duration-300" style={{ color: isOpen ? p.accent : '#4b5563', transform: isOpen ? 'translateX(4px)' : 'none' }}>
                    {isOpen ? '↑ Close' : 'Explore →'}
                  </div>

                  {/* Expansion panel */}
                  <div className="overflow-hidden transition-all duration-500 ease-in-out" style={{ maxHeight: isOpen ? 300 : 0 }}>
                    <div className="pt-5 mt-5" style={{ borderTop: `1px solid ${p.accent}33` }}>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: '#10b981' }}>Recommended Materials</span>
                      <div className="mt-3 space-y-2.5">
                        {p.materials.map(m => (
                          <div key={m.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
                              <span className="text-white text-[14px]">{m.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[13px]" style={{ color: '#10b981' }}>{m.price}</span>
                              <Link href="/browse" onClick={e => e.stopPropagation()} className="text-[11px] font-semibold transition-colors hover:underline" style={{ color: p.accent }}>Order →</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/material-match"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center justify-center gap-2 w-full mt-5 py-2.5 rounded-lg text-[13px] font-bold transition-all hover:opacity-90"
                        style={{ background: p.accent, color: '#0d1117' }}
                      >
                        Plan this project in Material Match <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5: PRICE INTELLIGENCE ═══ */}
      <section id="prices" className="py-12" style={{ background: '#0d1117' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Data</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-1">Market Prices Across America</h2>
          </div>

          {/* City tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none mb-6 pb-1">
            {Object.keys(CITY_PRICES).map(c => (
              <button key={c} onClick={() => setCity(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${city === c ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Price table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-4 gap-4 px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>Material</span><span>Price</span><span>30-Day Trend</span><span>vs National Avg</span>
            </div>
            {prices.map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 px-5 py-3 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-white font-medium">{row.mat}</span>
                <span className="text-white font-bold font-mono">{row.price}</span>
                <span className={`font-medium ${row.trendDir === 'up' ? 'text-amber-400' : row.trendDir === 'down' ? 'text-emerald-400' : 'text-gray-500'}`}>{row.trend}</span>
                <span className="text-gray-500">{row.vsAvg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6: SEASONAL STRIP ═══ */}
      <section className="py-6" style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-white font-extrabold text-lg flex items-center gap-2">🌱 Spring Rush: Order Now Before April Price Increases</div>
            <div className="text-amber-100 text-sm mt-1">Prices rise an average of 15% in April as demand peaks. Lock in current prices today.</div>
          </div>
          <Link href="/browse" className="btn bg-white text-amber-700 hover:bg-amber-50 font-bold px-6 py-3 rounded-xl shadow-lg flex-shrink-0 text-sm">
            Order at current prices →
          </Link>
        </div>
      </section>

      {/* ═══ SECTION 7: NEWSLETTER ═══ */}
      <section className="py-14" style={{ background: '#0d1117' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-extrabold text-white mb-2">Join 12,000+ contractors and homeowners</h2>
          <p className="text-gray-500 mb-6">Get weekly price alerts, project guides, and seasonal tips.</p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input type="email" placeholder="Enter your email" className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">Subscribe</button>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-gray-500">
            <span>📊 Weekly price alerts</span>
            <span>📖 Project guides</span>
            <span>🌿 Seasonal tips</span>
          </div>
        </div>
      </section>
    </div>
  )
}
