import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-gray-900 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight max-w-2xl">
              Order materials.<br />
              <span className="text-emerald-400">We deliver.</span>
            </h1>
            <p className="text-gray-400 text-lg mt-5 max-w-lg">
              Fill dirt, gravel, sand, topsoil, road base — ordered in minutes, delivered same-day to your job site.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/browse" className="btn-primary btn-xl text-base">
                Browse Materials <ArrowRight size={18} />
              </Link>
              <Link href="/material-match" className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20 btn-xl text-base">
                Find My Material →
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 bg-emerald-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Ready to build?</h2>
            <p className="text-emerald-100 mb-8">Get materials delivered to your job site.</p>
            <Link href="/browse" className="btn bg-white text-emerald-700 hover:bg-emerald-50 btn-xl font-bold shadow-xl inline-flex">
              Browse Materials <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
