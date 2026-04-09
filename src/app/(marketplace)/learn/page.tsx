import { LearnHub } from '@/components/marketplace/learn-hub'
import { collectionPageSchema, breadcrumbSchema, jsonLd } from '@/lib/structured-data'

export const metadata = {
  title: 'Knowledge Center — Material Guides, Calculators & Intelligence',
  description: 'The most comprehensive resource for aggregate materials. Calculators, project guides, price intelligence, and expert knowledge.',
  alternates: { canonical: '/learn' },
  openGraph: {
    title: 'Knowledge Center | EarthMove',
    description: 'Material guides, calculators, and expert knowledge for bulk aggregate projects.',
  },
}

export default function LearnPage() {
  const collection = collectionPageSchema({
    name: 'EarthMove Knowledge Center',
    description: 'Material guides, calculators, and project intelligence for bulk aggregates.',
    url: '/learn',
  })
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Learn', url: '/learn' },
  ])
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      <LearnHub />
    </>
  )
}
