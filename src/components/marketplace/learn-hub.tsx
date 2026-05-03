'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getArticleImage } from '@/lib/material-images'
import { ArrowRight, Clock } from 'lucide-react'
import {
  type Article,
  ARTICLES,
  getHeroArticle,
  getSecondaryFeaturedArticles,
  getArticlesByAudience,
} from '@/lib/learn/articles'

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'diy',         label: 'DIY' },
  { key: 'contractor',  label: 'Contractor' },
  { key: 'calculator',  label: 'Calculators' },
] as const

type FilterKey = typeof FILTERS[number]['key']

/* ─── MAIN COMPONENT ─── */
export function LearnHub() {
  const [filter, setFilter] = useState<FilterKey>('all')

  const allArticles = ARTICLES
  const filtered = useMemo(
    () => filter === 'all' ? allArticles : getArticlesByAudience(filter),
    [filter, allArticles]
  )
  let heroArticle: Article
  try {
    heroArticle = getHeroArticle()
  } catch (err) {
    console.error('learn-hub: getHeroArticle() failed', err)
    heroArticle = allArticles.find(a => !a.isStub) ?? allArticles[0]
  }
  const sideArticles = getSecondaryFeaturedArticles()

  return (
    <div style={{ background: 'var(--commerce-cream)' }}>
      {/* ═══ SECTION 1: HERO ═══ */}
      <section className="relative overflow-hidden min-h-[520px] flex flex-col justify-center">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2a1a 50%, #0d1117 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(16,185,129,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(245,158,11,0.06) 0%, transparent 50%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight" style={{ textShadow: '0 0 60px rgba(16,185,129,0.2)' }}>
              The EarthMove<br /><span className="text-emerald-400">Knowledge Center</span>
            </h1>
            <p className="text-base sm:text-lg mt-3 sm:mt-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Everything you need to know about aggregates. Built by industry experts.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              { icon: '🧮', title: 'Material Calculator', desc: 'Calculate exactly what you need', href: '/learn/cubic-yards-calculator' },
              { icon: '🔍', title: 'Material Match', desc: 'Find your perfect material', href: '/material-match' },
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

      {/* ═══ SECTION 3: ARTICLES ═══ */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {FILTERS.map(f => {
              const active = filter === f.key
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'}`}>
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
                      <span className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold capitalize">{heroArticle.audience}</span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="px-3 py-1 rounded-lg bg-black/50 text-white text-xs font-medium flex items-center gap-1"><Clock size={10} /> {heroArticle.readTime} min</span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white font-extrabold text-2xl leading-tight">{heroArticle.title}</h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-gray-500 text-sm line-clamp-2">{heroArticle.description}</p>
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
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold capitalize">{a.audience}</span>
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
            {(filter === 'all' ? allArticles.filter(a => !a.isFeatured && !a.isHero) : filtered).map(a => (
              <Link key={a.slug} href={`/learn/${a.slug}`} className="group block">
                <div className={`rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${a.audience === 'calculator' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                  <div className="relative h-44 overflow-hidden">
                    <img src={getArticleImage(a.slug)} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize ${
                        a.audience === 'diy' ? 'bg-blue-500 text-white' :
                        a.audience === 'contractor' ? 'bg-orange-500 text-white' :
                        'bg-emerald-500 text-white'
                      }`}>{a.audience}</span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">{a.readTime} min</span>
                    </div>
                    {/* Hover read button */}
                    <div className="absolute inset-x-3 bottom-3 translate-y-12 group-hover:translate-y-0 transition-transform duration-300">
                      <div className="bg-emerald-600 text-white rounded-xl py-2 text-center text-xs font-bold">Read Now →</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className={`font-bold text-sm leading-snug line-clamp-2 ${a.audience === 'calculator' ? 'text-white group-hover:text-emerald-400' : 'text-gray-900 group-hover:text-emerald-600'} transition-colors`}>{a.title}</h3>
                    <p className={`text-xs mt-2 line-clamp-2 ${a.audience === 'calculator' ? 'text-gray-400' : 'text-gray-500'}`}>{a.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 7: NEWSLETTER ═══ */}
      <section className="py-14" style={{ background: '#0d1117' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-extrabold text-white mb-2">Project guides, sent monthly.</h2>
          <p className="text-gray-500 mb-6">Spec deep-dives, calculators, and practical aggregate know-how. No spam.</p>
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
