import { getUserContext } from '@/lib/user-context'
import { MarketplaceHome } from '@/components/marketing/MarketplaceHome'
import { PreMarketHome } from '@/components/marketing/PreMarketHome'

export default async function HomePage() {
  const { market } = await getUserContext()
  return market ? <MarketplaceHome market={market} /> : <PreMarketHome />
}
