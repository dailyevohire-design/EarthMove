import { MaterialQuiz } from '@/components/marketplace/material-quiz'
import { breadcrumbSchema } from '@/lib/structured-data'

export const metadata = {
  title: 'Material Match — Find Your Perfect Material',
  description: 'Tell us about your project and we\'ll match you to the perfect bulk material. Takes 60 seconds. Used by 12,000+ homeowners and contractors.',
  alternates: { canonical: '/material-match' },
  openGraph: {
    title: 'Material Match | EarthMove',
    description: 'Answer a few questions and get matched to the right bulk material for your project.',
  },
}

export default function MaterialMatchPage() {
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Material Match', url: '/material-match' },
  ])
  // Light HowTo-style schema for the quiz itself
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Find the right bulk material for your project',
    description: 'A short quiz that recommends the correct bulk material based on your project type, site conditions, and goals.',
    totalTime: 'PT1M',
    step: [
      { '@type': 'HowToStep', name: 'Describe your project', text: 'Tell us what you\'re building or fixing.' },
      { '@type': 'HowToStep', name: 'Share site details', text: 'Drainage, grade, and expected traffic.' },
      { '@type': 'HowToStep', name: 'Get your match', text: 'We recommend the right material and quantity.' },
    ],
  }
  return (
    <main className="bg-gray-50/30 min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />
      <MaterialQuiz />
    </main>
  )
}
