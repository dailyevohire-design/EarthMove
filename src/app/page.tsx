import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">EarthMove</h1>
          <p className="text-gray-500 mb-8">Bulk materials, delivered.</p>
          <Link href="/browse" className="btn-primary btn-xl">Browse Materials</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
