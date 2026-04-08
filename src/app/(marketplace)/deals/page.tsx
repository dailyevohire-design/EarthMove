import { getCurrentMarket } from '@/lib/market'
import { getDeals } from '@/lib/deals'
import { DealSlider } from '@/components/marketplace/deal-slider'
import { DealGrid } from '@/components/marketplace/deal-grid'
import { Zap } from 'lucide-react'

export const metadata = {
  title: "Today's Deals on Bulk Materials",
  description: "Save on fill dirt, gravel, sand, and more. Flash sales, contractor deals, and limited-time promotions on bulk material delivery.",
  alternates: { canonical: '/deals' },
  openGraph: {
    title: "Today's Deals | EarthMove",
    description: 'Limited-time savings on bulk construction materials. Same-day delivery.',
  },
}

export default async function DealsPage() {
  const market = await getCurrentMarket()
  if (!market) return <div>No market selected</div>

  const { dealOfDay, deals } = await getDeals(market.id)

  return (
    <div className="bg-[#0a0a0a] min-h-screen">
      {/* Hero Deal */}
      {dealOfDay && (
        <DealSlider deal={dealOfDay} marketName={market.name} />
      )}

      {/* Deals Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-none">
            {['All Deals', 'Flash Sales', 'Contractor Deals', 'Weekend Only'].map((tab, i) => (
              <button
                key={tab}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  i === 0
                    ? 'bg-[#00ff88] text-black shadow-lg shadow-[#00ff88]/20'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {deals.length > 0 ? (
            <DealGrid deals={deals} />
          ) : (
            <div className="text-center py-20">
              <Zap size={40} className="text-[#00ff88]/30 mx-auto mb-4" />
              <p className="text-white/40 text-lg">More deals coming soon for {market.name}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
