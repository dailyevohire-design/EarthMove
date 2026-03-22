import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { MaterialQuiz } from '@/components/marketplace/material-quiz'

export const metadata = { title: 'Find Your Material — Quiz' }

export default function QuizPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-gray-50/30 min-h-screen">
        <MaterialQuiz />
      </main>
      <SiteFooter />
    </>
  )
}
