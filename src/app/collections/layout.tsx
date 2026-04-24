import { notFound } from 'next/navigation'
import { ReactNode } from 'react'
import { isCollectionsEnabled } from '@/lib/collections/feature-flag'
import { UPL_DISCLAIMER } from '@/lib/collections/disclaimer'

export const metadata = { title: 'Collections Assist — earthmove.io' }

export default function CollectionsLayout({ children }: { children: ReactNode }) {
  if (!isCollectionsEnabled()) notFound()
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div
          role="note"
          aria-label="Important legal disclaimer"
          className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900"
        >
          <div className="font-bold text-amber-900 mb-1">Important — Please read:</div>
          {UPL_DISCLAIMER}
        </div>
        {children}
      </div>
    </div>
  )
}
