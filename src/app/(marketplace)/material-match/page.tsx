import { MaterialQuiz } from '@/components/marketplace/material-quiz'

export const metadata = {
  title: 'Material Match — Find Your Perfect Material',
  description: 'Tell us about your project and we\'ll match you to the perfect bulk material. Takes 60 seconds. Used by 12,000+ homeowners and contractors.',
}

export default function MaterialMatchPage() {
  return (
    <main className="bg-gray-50/30 min-h-screen">
      <MaterialQuiz />
    </main>
  )
}
