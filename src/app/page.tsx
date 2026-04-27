import { getUserContext } from '@/lib/user-context'
import { MarketplaceHome } from '@/components/marketing/MarketplaceHome'
import { Homepage } from '@/components/marketing/Homepage'

export default async function HomePage() {
  const { market } = await getUserContext()
  return market ? <MarketplaceHome market={market} /> : <Homepage />
}
