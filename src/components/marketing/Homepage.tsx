/**
 * Homepage — v3 marketing landing.
 *
 * Server component. Bloomberg/Linear/Stripe-restraint, mobile-first.
 *
 * LAUNCH MARKETS: Denver + Dallas–Fort Worth (2026). Co-equal launch.
 * Portland and other cities (Houston, Austin, Phoenix, Las Vegas, Atlanta, Orlando,
 * Tampa, Charlotte) are expansion-only. Never claim them as live.
 * Do not invent product metrics. Do not list synthetic pricing as real.
 */
import '@/app/marketing-v3.css'
import { createClient } from '@/lib/supabase/server'
import { PROJECTS } from '@/lib/projects'
import { Header } from './v3/Header'
import { LiveRail } from './v3/LiveRail'
import { Hero } from './v3/Hero'
import { Metrics } from './v3/Metrics'
import { Projects } from './v3/Projects'
import { PricingEngine } from './v3/PricingEngine'
import { MarketDensity } from './v3/MarketDensity'
import { TrustBand } from './v3/TrustBand'
import { Dispatch } from './v3/Dispatch'
import { ActivityFeed } from './v3/ActivityFeed'
import { FootCTA } from './v3/FootCTA'

export async function Homepage() {
  const supabase = await createClient()

  // Live network counts for trust metrics
  const [yardsRes, materialsRes, marketsRes] = await Promise.all([
    supabase
      .from('supply_yards')
      .select('id, market_id, markets!inner(slug, is_active)', { count: 'exact', head: false })
      .eq('is_active', true)
      .eq('markets.is_active', true),
    supabase
      .from('material_catalog')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('markets')
      .select('id, slug')
      .eq('is_active', true)
      .in('slug', ['denver', 'dallas-fort-worth']),
  ])

  type YardRow = { id: string; market_id: string; markets: { slug: string; is_active: boolean } }
  const yardRows = (yardsRes.data ?? []) as unknown as YardRow[]
  const yardsByMarketSlug = yardRows.reduce<Record<string, number>>((acc, r) => {
    const slug = r.markets?.slug
    if (slug) acc[slug] = (acc[slug] ?? 0) + 1
    return acc
  }, {})

  const yardsCount = yardRows.length
  const materialsCount = materialsRes.count ?? 0
  const denverYards = yardsByMarketSlug['denver'] ?? 0
  const dfwYards = yardsByMarketSlug['dallas-fort-worth'] ?? 0
  const liveMarkets = (marketsRes.data ?? []).length

  return (
    <div className="marketing-v3">
      <div className="marketing-v3-shell">
        <Header />
        <LiveRail
          yardsCount={yardsCount}
          materialsCount={materialsCount}
          denverYards={denverYards}
          dfwYards={dfwYards}
        />
        <Hero projects={PROJECTS} />
        <Metrics
          yardsCount={yardsCount}
          materialsCount={materialsCount}
          denverYards={denverYards}
          dfwYards={dfwYards}
        />

        <div className="v3-sec">
          <div className="v3-sec-eyebrow">— 01 · Project routing</div>
          <h2 className="v3-sec-h">What are you<br /><em>building?</em></h2>
          <p className="v3-sec-sub">Skip the catalog. Name the outcome — we route material, yard, and truck class.</p>
        </div>
        <Projects projects={PROJECTS} />

        <PricingEngine />

        <div className="v3-sec">
          <div className="v3-sec-eyebrow">— 03 · Network coverage</div>
          <h2 className="v3-sec-h">
            Operational across<br />
            <em>{liveMarkets === 1 ? '1 metro' : `${liveMarkets} metros`}.</em>
          </h2>
          <p className="v3-sec-sub">Verified yards, dispatch corridors, and fleet. Portland next on the expansion pipeline.</p>
        </div>
        <MarketDensity denverYards={denverYards} dfwYards={dfwYards} />

        <TrustBand yardsCount={yardsCount} />

        <div className="v3-sec">
          <div className="v3-sec-eyebrow">— 04 · Live dispatch</div>
          <h2 className="v3-sec-h">The trucks are<br />already <em>moving.</em></h2>
          <p className="v3-sec-sub">Real loads, real ETAs, real dispatch from the network you&apos;re about to join.</p>
        </div>
        <div className="v3-dispatch-grid">
          <Dispatch />
          <ActivityFeed />
        </div>

        <FootCTA yardsCount={yardsCount} liveMarkets={liveMarkets} />

        <div className="v3-legal">
          <span>DEN · DFW launching today · Portland next</span>
          <span>v3.0</span>
        </div>
      </div>
    </div>
  )
}
