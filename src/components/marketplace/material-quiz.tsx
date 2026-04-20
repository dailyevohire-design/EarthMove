'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'

type Step = 0 | 1 | 2 | 3 | 4
type Answers = {
  project: string
  size: string
  budget: string
  delivery: string
  priority: string
}

const QUESTIONS = [
  {
    title: 'What is your project?',
    key: 'project' as const,
    options: [
      { value: 'driveway', label: 'Driveway', icon: '🚗' },
      { value: 'landscaping', label: 'Landscaping', icon: '🌿' },
      { value: 'drainage', label: 'Drainage', icon: '💧' },
      { value: 'construction', label: 'Construction', icon: '🏗️' },
      { value: 'other', label: 'Other', icon: '📦' },
    ],
  },
  {
    title: 'What is the surface size?',
    key: 'size' as const,
    options: [
      { value: 'small', label: 'Small', icon: '📏', desc: 'Under 500 sq ft' },
      { value: 'medium', label: 'Medium', icon: '📐', desc: '500 – 2,000 sq ft' },
      { value: 'large', label: 'Large', icon: '🏟️', desc: 'Over 2,000 sq ft' },
    ],
  },
  {
    title: 'What is your budget?',
    key: 'budget' as const,
    options: [
      { value: 'low', label: 'Under $500', icon: '💵' },
      { value: 'mid', label: '$500 – $2,000', icon: '💰' },
      { value: 'high', label: 'Over $2,000', icon: '🏦' },
    ],
  },
  {
    title: 'Do you need delivery?',
    key: 'delivery' as const,
    options: [
      { value: 'asap', label: 'Yes, ASAP', icon: '⚡' },
      { value: 'scheduled', label: 'Yes, Scheduled', icon: '📅' },
      { value: 'pickup', label: 'I\'ll pick up', icon: '🚚' },
    ],
  },
  {
    title: 'What matters most?',
    key: 'priority' as const,
    options: [
      { value: 'price', label: 'Lowest Price', icon: '💲' },
      { value: 'speed', label: 'Fastest Delivery', icon: '🏃' },
      { value: 'quality', label: 'Best Quality', icon: '⭐' },
    ],
  },
]

function getRecommendations(answers: Answers) {
  const recs: Array<{ name: string; slug: string; reason: string }> = []

  if (answers.project === 'driveway') {
    recs.push(
      { name: 'Flex Base', slug: 'flex-base', reason: 'The #1 choice for driveway construction. Compacts hard and lasts for years.' },
      { name: 'Road Base', slug: 'road-base', reason: 'Affordable driveway foundation. Great for rural driveways and ranch roads.' },
      { name: 'Pea Gravel', slug: 'pea-gravel', reason: 'Decorative topping for finished driveways. Low maintenance and great drainage.' },
    )
  } else if (answers.project === 'landscaping') {
    recs.push(
      { name: 'Topsoil', slug: 'topsoil', reason: 'Rich growing medium for lawns, gardens, and flower beds.' },
      { name: 'Decomposed Granite', slug: 'decomposed-granite', reason: 'Beautiful natural pathways and xeriscaping ground cover.' },
      { name: 'Washed River Rock', slug: 'washed-river-rock', reason: 'Stunning decorative stone for dry creek beds and garden borders.' },
    )
  } else if (answers.project === 'drainage') {
    recs.push(
      { name: 'Pea Gravel', slug: 'pea-gravel', reason: 'Excellent drainage stone for French drains and dry wells.' },
      { name: 'Base Gravel #57', slug: 'base-gravel-57', reason: 'Angular crushed stone ideal for drainage behind retaining walls.' },
      { name: 'Washed River Rock', slug: 'washed-river-rock', reason: 'Smooth stones for decorative drainage channels and swales.' },
    )
  } else if (answers.project === 'construction') {
    recs.push(
      { name: 'Fill Dirt', slug: 'fill-dirt', reason: 'Essential for backfilling, grading, and site preparation.' },
      { name: 'Select Fill', slug: 'select-fill', reason: 'Engineering-grade fill for structural applications.' },
      { name: 'Concrete Sand', slug: 'concrete-sand', reason: 'Required for concrete mixing and pipe bedding.' },
    )
  } else {
    recs.push(
      { name: 'Fill Dirt', slug: 'fill-dirt', reason: 'Versatile and affordable for general projects.' },
      { name: 'Topsoil', slug: 'topsoil', reason: 'Perfect for any yard, garden, or planting project.' },
      { name: 'Pea Gravel', slug: 'pea-gravel', reason: 'Decorative and functional for walkways and ground cover.' },
    )
  }

  if (answers.priority === 'price') {
    recs.sort((a, b) => {
      const cheapOrder = ['fill-dirt', 'road-base', 'select-fill', 'crushed-concrete']
      return (cheapOrder.indexOf(a.slug) === -1 ? 99 : cheapOrder.indexOf(a.slug)) -
             (cheapOrder.indexOf(b.slug) === -1 ? 99 : cheapOrder.indexOf(b.slug))
    })
  }

  return recs.slice(0, 3)
}

export function MaterialQuiz() {
  const [step, setStep] = useState<Step>(0)
  const [answers, setAnswers] = useState<Answers>({ project: '', size: '', budget: '', delivery: '', priority: '' })
  const [done, setDone] = useState(false)

  const question = QUESTIONS[step]
  const progress = ((step + 1) / QUESTIONS.length) * 100

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [question.key]: value }
    setAnswers(newAnswers)
    if (step < 4) {
      setStep((step + 1) as Step)
    } else {
      setDone(true)
    }
  }

  const recommendations = done ? getRecommendations(answers) : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
      {!done ? (
        <>
          {/* Header - only on first question */}
          {step === 0 && (
            <div className="text-center mb-10">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Material Match</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2 mb-3">Tell us about your project.<br />We'll find your perfect material.</h1>
              <p className="text-gray-500 text-sm">Takes 60 seconds. Used by 12,000+ homeowners and contractors.</p>
            </div>
          )}

          {/* Progress */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step {step + 1} of {QUESTIONS.length}</span>
              {step > 0 && (
                <button onClick={() => setStep((step - 1) as Step)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft size={12} /> Back
                </button>
              )}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-8">{question.title}</h1>

          <div className="grid grid-cols-1 gap-3">
            {question.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className="group flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all duration-200 text-left"
              >
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">{opt.label}</div>
                  {'desc' in opt && <div className="text-sm text-gray-500">{(opt as any).desc}</div>}
                </div>
                <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Results */
        <div className="animate-fade-up">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Your top materials</h1>
            <p className="text-gray-500">Based on your {answers.project} project</p>
          </div>

          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <div key={rec.slug} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{rec.name}</h3>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">{rec.reason}</p>
                    <Link
                      href={`/browse/${rec.slug}`}
                      className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Order Now <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/browse" className="btn-primary btn-lg flex-1 justify-center">Browse All Materials</Link>
            <button onClick={() => { setDone(false); setStep(0); setAnswers({ project: '', size: '', budget: '', delivery: '', priority: '' }) }}
              className="btn-secondary btn-lg flex-1 justify-center">
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
