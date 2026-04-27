import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main data-surface="commerce" className="flex-1 min-h-0">{children}</main>
      <SiteFooter />
    </>
  )
}
