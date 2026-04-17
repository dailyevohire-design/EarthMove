import { PageHead } from '@/components/contractor/PageHead'

export const metadata = { title: 'Marketplace — earthmove.io' }

export default function MarketplacePlaceholder() {
  return (
    <>
      <PageHead
        kicker="Marketplace"
        title={<>Browse every <em>supplier near you</em>.</>}
        subtitle="Filter by material, verification status, capacity, and delivery radius. Save favorites."
      />
      <div className="ec-placeholder">
        <span className="ec-placeholder__badge">Coming in Tranche 3</span>
      </div>
    </>
  )
}
