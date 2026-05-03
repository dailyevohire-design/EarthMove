'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ArrowRight, ArrowLeft, Check, Star, AlertCircle, Loader2 } from 'lucide-react'
import { recordVerifiedIntent, submitSourcingRequiredLead } from '@/app/(marketplace)/material-match/actions'

// =============================================================================
// VERIFIED-STOCK CATALOG MAPPING (hardcoded for v1, see C4.1 followup)
// Real material_catalog UUIDs from Supabase. "Crushed Limestone" doubles as
// the canonical entry for "#57 Crushed Stone" (which is a gradation of it).
// =============================================================================

const CATALOG = {
  CRUSHED_LIMESTONE_57: '7b0cee52-a89a-4601-98b9-f027c809e529', // displays as "#57 Crushed Stone"
  ROAD_BASE: '00b032d1-f6b4-406f-bdad-6da3869f7241',
  FILL_DIRT: 'ba7d5c6c-4595-4a3d-ac94-45f0b2003efa',
  TOPSOIL: '5914c3ff-a3f9-45f6-8080-edccc1fd7396',
} as const

// Note: verification rule is currently project_type/sub_type-based (see
// getMatchResult below). When C4.1 swaps in a real supplier_offerings query,
// the catalog UUIDs above become the SELECT key set.

// =============================================================================
// WIZARD QUESTIONS
// =============================================================================

type ProjectType = 'driveway' | 'foundation' | 'drainage' | 'landscaping' | 'erosion' | 'custom'

const PROJECT_TYPES: Array<{ value: ProjectType; label: string; desc: string }> = [
  { value: 'driveway',    label: 'Driveway',          desc: 'New build, resurface, or repair' },
  { value: 'foundation',  label: 'Foundation',        desc: 'Pad prep, structural fill' },
  { value: 'drainage',    label: 'Drainage',          desc: 'French drain, swale, dry well' },
  { value: 'landscaping', label: 'Landscaping',       desc: 'Beds, paths, decorative' },
  { value: 'erosion',     label: 'Erosion control',   desc: 'Slope stabilization, riprap' },
  { value: 'custom',      label: 'Custom site work',  desc: 'Something else' },
]

const SUB_TYPES: Record<ProjectType, Array<{ value: string; label: string; desc: string }>> = {
  driveway: [
    { value: 'new-build',  label: 'New build',    desc: 'Excavating + building from scratch' },
    { value: 'resurface',  label: 'Resurface',    desc: 'Top-layer refresh on existing base' },
    { value: 'patches',    label: 'Repair patches', desc: 'Filling potholes or worn spots' },
    { value: 'extension',  label: 'Extension',    desc: 'Adding length or width' },
  ],
  foundation: [
    { value: 'shed-pad',   label: 'Shed or playset pad', desc: '4–8" base under structure' },
    { value: 'slab-prep',  label: 'Slab prep',           desc: 'Compacted base for concrete' },
    { value: 'backfill',   label: 'Backfill',            desc: 'Around foundation walls' },
    { value: 'fill-low',   label: 'Raising low spots',   desc: '½–2 yards in problem areas' },
  ],
  drainage: [
    { value: 'french-drain', label: 'French drain',     desc: 'Perforated pipe + stone' },
    { value: 'swale',        label: 'Swale or channel', desc: 'Surface drainage path' },
    { value: 'dry-well',     label: 'Dry well',         desc: 'Underground reservoir' },
    { value: 'specialty',    label: 'Specialty (Lime Rock, etc.)', desc: 'Non-standard spec' },
  ],
  landscaping: [
    { value: 'planting',     label: 'Planting beds',    desc: 'Topsoil + amendments' },
    { value: 'walkway',      label: 'Walkway or path',  desc: 'Pea gravel or DG' },
    { value: 'decorative',   label: 'Decorative stone', desc: 'River rock, accent' },
    { value: 'lawn',         label: 'New lawn',         desc: 'Topsoil for seeding' },
  ],
  erosion: [
    { value: 'slope',        label: 'Slope stabilization', desc: 'Riprap on hillside' },
    { value: 'channel',      label: 'Channel armor',       desc: 'Drainage channel lining' },
    { value: 'shoreline',    label: 'Shoreline',           desc: 'Pond or creek edge' },
    { value: 'specialty',    label: 'Specialty (large class)', desc: 'D50 > 12"' },
  ],
  custom: [
    { value: 'bulk-fill',    label: 'Bulk fill order',  desc: 'Just need volume, any spec' },
    { value: 'unsure',       label: 'I don\'t know yet', desc: 'We\'ll help figure it out' },
  ],
}

const DELIVERY_WINDOWS = [
  { value: 'this_week',    label: 'This week',       desc: 'Need it ASAP' },
  { value: 'next_2_weeks', label: 'Next 2 weeks',    desc: 'Planning ahead' },
  { value: 'this_month',   label: 'This month',      desc: 'Flexible timing' },
  { value: 'researching',  label: 'Just researching', desc: 'No rush yet' },
] as const

const TONS_HELPER: Record<ProjectType, string> = {
  driveway:    'Most driveways need 8–25 tons',
  foundation:  '4–15 tons for typical pads',
  drainage:    '3–10 tons per 50 linear feet',
  landscaping: '1–5 tons for residential beds',
  erosion:     '5–30 tons depending on slope',
  custom:      'Tell us your best estimate',
}

// =============================================================================
// MATCH RESULT LOGIC
// =============================================================================

interface MaterialOption {
  catalog_id: string
  name: string                   // display name (may differ from DB)
  why: string                    // 1-line "why this material"
  specs: string                  // mono-text specs strip
  price_lo: number
  price_hi: number
  supplier_count?: number
}

interface VerifiedResult {
  kind: 'verified'
  hero: MaterialOption & { whyLong: string }
  alternates: MaterialOption[]
}

interface SourcingResult {
  kind: 'sourcing-required'
  hero: {
    name: string
    whyLong: string
    catalog_id: string | null
  }
  substitutes: MaterialOption[]
}

type MatchResult = VerifiedResult | SourcingResult

const M: Record<string, MaterialOption> = {
  'crushed-limestone-57': {
    catalog_id: CATALOG.CRUSHED_LIMESTONE_57,
    name: '#57 Crushed Stone',
    why: 'Top pick for new driveway construction. Compacts well and drains fast.',
    specs: 'Gradation ¾"–#4 · Density 1.4 t/yd³ · Coverage ~110 sqft @ 4"',
    price_lo: 32,
    price_hi: 48,
    supplier_count: 4,
  },
  'road-base': {
    catalog_id: CATALOG.ROAD_BASE,
    name: 'Road Base',
    why: 'The cheaper structural workhorse — perfect when budget matters.',
    specs: 'TxDOT Item 247 · Density 1.5 t/yd³ · Coverage ~108 sqft @ 4"',
    price_lo: 22,
    price_hi: 32,
    supplier_count: 6,
  },
  'fill-dirt': {
    catalog_id: CATALOG.FILL_DIRT,
    name: 'Fill Dirt',
    why: 'Bulk volume at the lowest price — for grading and rough fill.',
    specs: 'Native clay/loam · Density 1.1 t/yd³ · Coverage ~147 sqft @ 4"',
    price_lo: 10,
    price_hi: 18,
    supplier_count: 8,
  },
  'topsoil': {
    catalog_id: CATALOG.TOPSOIL,
    name: 'Topsoil',
    why: 'Rich growing medium for lawns, beds, and finish grading.',
    specs: 'Screened ⅜" · Density 1.3 t/yd³ · Coverage ~125 sqft @ 4"',
    price_lo: 38,
    price_hi: 52,
    supplier_count: 5,
  },
}

function getMatchResult(
  project_type: ProjectType,
  sub_type: string,
): MatchResult {
  // Drainage + specialty → sourcing required (Lime Rock #57)
  if (project_type === 'drainage' && sub_type === 'specialty') {
    return {
      kind: 'sourcing-required',
      hero: {
        name: 'Lime Rock #57',
        catalog_id: null,
        whyLong:
          "Your spec calls for Lime Rock at #57 gradation — common in Florida and parts of the Gulf Coast, but DFW yards stock it sparingly. We source it from regional partners on demand. Once you reserve, we lock pricing and confirm a delivery slot within 24 hours.",
      },
      substitutes: [M['crushed-limestone-57'], M['road-base'], M['fill-dirt']],
    }
  }
  if (project_type === 'erosion' && sub_type === 'specialty') {
    return {
      kind: 'sourcing-required',
      hero: {
        name: 'Class IV Riprap (D50 > 12")',
        catalog_id: null,
        whyLong:
          "Class IV riprap (mean stone > 12 inches) handles serious slope and channel erosion but isn't a stocked DFW SKU. We source on order from regional quarries. Reserve to lock spec and pricing before delivery is scheduled.",
      },
      substitutes: [M['crushed-limestone-57'], M['road-base'], M['fill-dirt']],
    }
  }

  // Verified-stock paths
  if (project_type === 'driveway') {
    return {
      kind: 'verified',
      hero: {
        ...M['crushed-limestone-57'],
        whyLong:
          'For new driveway construction, #57 crushed stone is the gold-standard top course. It compacts under traffic, drains rain instantly, and resists rutting better than cheaper grades. Order 8–25 tons depending on length and width.',
      },
      alternates: [M['road-base'], M['fill-dirt'], M['topsoil']],
    }
  }
  if (project_type === 'foundation') {
    return {
      kind: 'verified',
      hero: {
        ...M['road-base'],
        whyLong:
          'Road base compacts to a near-solid platform — exactly what slabs and pads need under them. Cheaper than crushed stone and faster to install. 4–6 inches over a proof-rolled subgrade is the standard build.',
      },
      alternates: [M['crushed-limestone-57'], M['fill-dirt'], M['topsoil']],
    }
  }
  if (project_type === 'drainage' || project_type === 'landscaping') {
    return {
      kind: 'verified',
      hero: {
        ...M['crushed-limestone-57'],
        whyLong:
          project_type === 'drainage'
            ? '#57 is the canonical drainage stone — the angular shape creates void space for water to move while still locking together. Wrap in geotextile to keep fines out.'
            : 'For accent beds, walkways, and decorative ground cover, #57 holds shape better than pea gravel and lasts decades without compaction loss.',
      },
      alternates: [M['road-base'], M['topsoil'], M['fill-dirt']],
    }
  }
  // Default (custom or anything else): fill dirt
  return {
    kind: 'verified',
    hero: {
      ...M['fill-dirt'],
      whyLong:
        'When the spec is fuzzy or you just need volume, fill dirt is the cheapest cubic yard you can get. We can swap to a more specific material if you tell us more about the build.',
    },
    alternates: [M['road-base'], M['crushed-limestone-57'], M['topsoil']],
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PAGE_BG = 'bg-[var(--commerce-cream)]'
const INK = 'text-[var(--commerce-ink)]'
const MUTED = 'text-[var(--commerce-ink-3)]'
const PRIMARY = 'var(--commerce-trust)'
const TINT = '#f0f7f3'
const HAIRLINE = 'rgba(0,0,0,0.08)'

export function MaterialQuiz() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const step = params.get('step') ?? '1'
  const project_type = params.get('project_type') as ProjectType | null
  const sub_type = params.get('sub_type')
  const tons = params.get('tons')
  const zip = params.get('zip')
  const delivery_window = params.get('delivery_window')

  const setParam = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`${pathname}?${sp.toString()}`)
  }

  // Branch: results page
  if (step === 'results') {
    if (!project_type) {
      return <RestartHint onRestart={() => router.push(pathname)} />
    }
    const result = getMatchResult(project_type, sub_type ?? '')
    return (
      <ResultPage
        result={result}
        ctx={{ project_type, sub_type, tons, zip, delivery_window }}
        onRestart={() => router.push(pathname)}
      />
    )
  }

  return (
    <div className={`${PAGE_BG} min-h-screen`}>
      <div className="max-w-[760px] mx-auto px-6 py-12 md:py-16">
        <ProgressStrip current={parseInt(step, 10)} onBack={() => router.back()} />
        {step === '1' && (
          <Step
            title="What are you building?"
            options={PROJECT_TYPES}
            onPick={(value) => setParam({ project_type: value, step: '2', sub_type: null })}
          />
        )}
        {step === '2' && project_type && (
          <Step
            title="Tell us a bit more"
            options={SUB_TYPES[project_type]}
            onPick={(value) => setParam({ sub_type: value, step: '3' })}
          />
        )}
        {step === '3' && project_type && (
          <TonsStep
            project_type={project_type}
            current={tons}
            onSubmit={(v) => setParam({ tons: v, step: '4' })}
          />
        )}
        {step === '4' && (
          <ZipStep
            current={zip}
            onSubmit={(v) => setParam({ zip: v, step: '5' })}
          />
        )}
        {step === '5' && (
          <Step
            title="When do you need it?"
            options={DELIVERY_WINDOWS as unknown as Array<{ value: string; label: string; desc: string }>}
            onPick={(value) => setParam({ delivery_window: value, step: 'results' })}
          />
        )}
      </div>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ProgressStrip({ current, onBack }: { current: number; onBack: () => void }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--commerce-ink-3)]">
          Step {Math.min(current, 5)} of 5
        </span>
        {current > 1 && (
          <button
            onClick={onBack}
            className="text-xs text-[var(--commerce-ink-3)] hover:text-[var(--commerce-ink)] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= current
          const done = i < current
          return (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: filled ? PRIMARY : 'rgba(0,0,0,0.08)' }}
              aria-current={i === current ? 'step' : undefined}
              aria-label={done ? 'completed' : i === current ? 'current' : 'upcoming'}
            />
          )
        })}
      </div>
    </div>
  )
}

interface StepOption {
  value: string
  label: string
  desc: string
}

function Step({
  title,
  options,
  onPick,
}: {
  title: string
  options: ReadonlyArray<StepOption>
  onPick: (value: string) => void
}) {
  return (
    <>
      <h1
        className={`${INK} text-3xl md:text-4xl mb-2 leading-tight font-medium tracking-[-0.015em]`}
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        {title}
      </h1>
      <p className={`${MUTED} text-base mb-8`}>Pick the closest match.</p>
      <div className="grid gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onPick(opt.value)}
            className={`group flex items-start gap-4 p-5 rounded-xl bg-white border border-[${HAIRLINE}] hover:border-[${PRIMARY}] hover:bg-[${TINT}] transition-all text-left`}
          >
            <div className="flex-1">
              <div className={`${INK} font-semibold text-[15.5px] leading-tight`}>{opt.label}</div>
              <div className={`${MUTED} text-[13.5px] mt-1`}>{opt.desc}</div>
            </div>
            <ArrowRight size={16} className="text-[var(--commerce-ink-3)] group-hover:text-[var(--commerce-trust)] transition-colors mt-1" />
          </button>
        ))}
      </div>
    </>
  )
}

function TonsStep({
  project_type,
  current,
  onSubmit,
}: {
  project_type: ProjectType
  current: string | null
  onSubmit: (v: string) => void
}) {
  const [val, setVal] = useState(current ?? '')
  const valid = /^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(val)
      }}
    >
      <h1
        className={`${INK} text-3xl md:text-4xl mb-2 leading-tight font-medium tracking-[-0.015em]`}
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        How many tons?
      </h1>
      <p className={`${MUTED} text-base mb-8`}>{TONS_HELPER[project_type]}</p>
      <div className="relative max-w-sm">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. 18"
          className={`w-full h-16 px-5 pr-20 rounded-xl bg-white border border-[${HAIRLINE}] text-2xl font-medium text-[var(--commerce-ink)] focus:outline-none focus:border-[var(--commerce-trust)] focus:ring-2 focus:ring-[var(--commerce-trust)]/10`}
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--commerce-ink-3)] font-mono text-sm">
          tons
        </span>
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="mt-6 inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] disabled:bg-[var(--commerce-trust)]/40 disabled:cursor-not-allowed text-white font-semibold text-base h-12 px-6 rounded-full transition-colors"
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </button>
    </form>
  )
}

function ZipStep({
  current,
  onSubmit,
}: {
  current: string | null
  onSubmit: (v: string) => void
}) {
  const [val, setVal] = useState(current ?? '')
  const valid = /^\d{5}$/.test(val)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(val)
      }}
    >
      <h1
        className={`${INK} text-3xl md:text-4xl mb-2 leading-tight font-medium tracking-[-0.015em]`}
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        Where is the project?
      </h1>
      <p className={`${MUTED} text-base mb-8`}>5-digit ZIP code so we can match local suppliers.</p>
      <div className="relative max-w-sm">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
          placeholder="75201"
          className={`w-full h-16 px-5 rounded-xl bg-white border border-[${HAIRLINE}] text-2xl font-mono tracking-[0.1em] text-[var(--commerce-ink)] focus:outline-none focus:border-[var(--commerce-trust)] focus:ring-2 focus:ring-[var(--commerce-trust)]/10`}
        />
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="mt-6 inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] disabled:bg-[var(--commerce-trust)]/40 disabled:cursor-not-allowed text-white font-semibold text-base h-12 px-6 rounded-full transition-colors"
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        Continue <ArrowRight className="ml-2 w-4 h-4" />
      </button>
    </form>
  )
}

function RestartHint({ onRestart }: { onRestart: () => void }) {
  return (
    <div className={`${PAGE_BG} min-h-screen`}>
      <div className="max-w-[760px] mx-auto px-6 py-20 text-center">
        <h1
          className={`${INK} text-3xl mb-3`}
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          Let&apos;s start over
        </h1>
        <p className={`${MUTED} mb-6`}>We need a few details to recommend a material.</p>
        <button
          onClick={onRestart}
          className="inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] text-white font-semibold text-base h-12 px-6 rounded-full transition-colors"
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          Start the wizard <ArrowRight className="ml-2 w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// RESULT PAGE
// =============================================================================

interface ResultCtx {
  project_type: ProjectType
  sub_type: string | null
  tons: string | null
  zip: string | null
  delivery_window: string | null
}

function ResultPage({
  result,
  ctx,
  onRestart,
}: {
  result: MatchResult
  ctx: ResultCtx
  onRestart: () => void
}) {
  return (
    <div className={`${PAGE_BG} min-h-screen`}>
      <div className="max-w-[1080px] mx-auto px-6 py-12 md:py-16">
        <button
          onClick={onRestart}
          className="text-xs text-[var(--commerce-ink-3)] hover:text-[var(--commerce-ink)] flex items-center gap-1.5 transition-colors mb-6"
        >
          <ArrowLeft size={12} /> Start over
        </button>

        {result.kind === 'verified' ? (
          <VerifiedLayout result={result} ctx={ctx} />
        ) : (
          <SourcingLayout result={result} ctx={ctx} />
        )}
      </div>
    </div>
  )
}

function VerifiedLayout({ result, ctx }: { result: VerifiedResult; ctx: ResultCtx }) {
  return (
    <>
      {/* Hero card */}
      <article
        className={`bg-white border border-[${HAIRLINE}] rounded-xl p-8 md:p-10`}
      >
        <div className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--commerce-trust)] mb-3">
          Best match
        </div>
        <h1
          className={`${INK} text-4xl md:text-[40px] leading-[1.1] font-medium tracking-[-0.02em] mb-4`}
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          {result.hero.name}
        </h1>
        <p className={`${INK} text-lg leading-[1.5] mb-6 max-w-[640px]`}>{result.hero.whyLong}</p>
        <div className="font-mono text-[12.5px] text-[var(--commerce-ink-2)] tracking-[0.04em] uppercase mb-6">
          {result.hero.specs}
        </div>
        <div className="flex items-baseline gap-3 mb-8">
          <span
            className={`${INK} text-[28px] font-medium`}
            style={{ fontFamily: 'var(--font-fraunces), serif' }}
          >
            ${result.hero.price_lo}–${result.hero.price_hi}/ton
          </span>
          {result.hero.supplier_count != null && (
            <span className={`${MUTED} text-sm`}>
              · {result.hero.supplier_count} verified DFW suppliers
            </span>
          )}
        </div>

        <VerifiedCTAForm
          material_catalog_id={result.hero.catalog_id}
          material_name={result.hero.name}
          ctx={ctx}
          label="Order this material"
          variant="primary"
        />
      </article>

      {/* Alternates */}
      <h2
        className={`${INK} text-2xl mt-12 mb-5 font-medium tracking-[-0.015em]`}
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        Or consider these
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {result.alternates.map((alt) => (
          <article
            key={alt.catalog_id}
            className={`bg-white border border-[${HAIRLINE}] rounded-xl p-6 flex flex-col`}
          >
            <h3
              className={`${INK} text-xl mb-2 font-medium tracking-[-0.015em]`}
              style={{ fontFamily: 'var(--font-fraunces), serif' }}
            >
              {alt.name}
            </h3>
            <p className={`${MUTED} text-sm leading-[1.5] mb-4`}>{alt.why}</p>
            <div className="font-mono text-[11px] text-[var(--commerce-ink-3)] tracking-[0.04em] uppercase mb-3 leading-relaxed">
              {alt.specs}
            </div>
            <div className={`${INK} text-base font-medium mb-4 mt-auto`}>
              ${alt.price_lo}–${alt.price_hi}/ton
            </div>
            <VerifiedCTAForm
              material_catalog_id={alt.catalog_id}
              material_name={alt.name}
              ctx={ctx}
              label="View this option"
              variant="secondary"
            />
          </article>
        ))}
      </div>
    </>
  )
}

function VerifiedCTAForm({
  material_catalog_id,
  material_name,
  ctx,
  label,
  variant,
}: {
  material_catalog_id: string
  material_name: string
  ctx: ResultCtx
  label: string
  variant: 'primary' | 'secondary'
}) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={() =>
        startTransition(async () => {
          await recordVerifiedIntent({
            material_catalog_id,
            material_name,
            tons: ctx.tons ? parseFloat(ctx.tons) : null,
            zip: ctx.zip,
            project_type: ctx.project_type,
            sub_type: ctx.sub_type,
            delivery_window: ctx.delivery_window,
          })
        })
      }
    >
      <button
        type="submit"
        disabled={pending}
        className={
          variant === 'primary'
            ? 'w-full inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] disabled:bg-[var(--commerce-trust)]/60 text-white font-semibold text-lg h-16 rounded-xl transition-colors'
            : 'w-full inline-flex items-center justify-center bg-white hover:bg-[#fafafa] disabled:bg-[#fafafa] text-[var(--commerce-trust)] font-semibold text-base h-12 rounded-xl border border-[var(--commerce-trust)] transition-colors'
        }
        style={{ fontFamily: 'var(--font-fraunces), serif' }}
      >
        {pending ? <Loader2 className="animate-spin w-5 h-5" /> : <>{label} <ArrowRight className="ml-2 w-5 h-5" /></>}
      </button>
    </form>
  )
}

function SourcingLayout({ result, ctx }: { result: SourcingResult; ctx: ResultCtx }) {
  const [reserveOpen, setReserveOpen] = useState(false)
  return (
    <>
      {/* Sourcing hero */}
      <article
        className="bg-[#fffaf0] border border-[#f59e0b]/40 rounded-xl p-8 md:p-10"
      >
        <div className="text-xs font-semibold tracking-[0.18em] uppercase text-[#a16207] mb-3 flex items-center gap-2">
          <Star className="w-3 h-3 fill-current" />
          Sourcing required · DFW
        </div>
        <h1
          className={`${INK} text-4xl md:text-[40px] leading-[1.1] font-medium tracking-[-0.02em] mb-4`}
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          {result.hero.name}
        </h1>
        <p className={`${INK} text-lg leading-[1.5] mb-6 max-w-[640px]`}>{result.hero.whyLong}</p>

        <div className="flex items-start gap-3 mb-8 p-4 rounded-lg bg-[#fef3c7]/40 border border-[#f59e0b]/20">
          <Star className="w-4 h-4 text-[#a16207] fill-current flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--commerce-ink-2)] leading-[1.5]">
            We&apos;ve sourced 47 specialty materials for DFW projects in the last 90 days.
            Avg sourcing time: <strong>38 hours</strong>.
          </p>
        </div>

        {!reserveOpen && (
          <>
            <button
              onClick={() => setReserveOpen(true)}
              className="w-full inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] text-white font-semibold text-lg h-16 rounded-xl transition-colors"
              style={{ fontFamily: 'var(--font-fraunces), serif' }}
            >
              Reserve this material <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <p className={`${MUTED} text-xs text-center mt-3`}>
              Sales rep will contact you within 24 hours.
            </p>
          </>
        )}

        {reserveOpen && (
          <ReserveLeadForm
            material_name={result.hero.name}
            material_catalog_id={result.hero.catalog_id}
            ctx={ctx}
            onCancel={() => setReserveOpen(false)}
          />
        )}
      </article>

      {/* Substitutes */}
      <div className="mt-12">
        <h2
          className={`${INK} text-2xl md:text-[26px] mb-2 font-medium tracking-[-0.015em]`}
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          Available in DFW now — order today instead of reserving
        </h2>
        <p className={`${MUTED} text-base mb-6`}>
          If timing matters more than spec match, these are stocked and ready to dispatch.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {result.substitutes.map((alt) => (
            <article
              key={alt.catalog_id}
              className={`bg-white border border-[${HAIRLINE}] rounded-xl p-6 flex flex-col`}
            >
              <h3
                className={`${INK} text-xl mb-2 font-medium tracking-[-0.015em]`}
                style={{ fontFamily: 'var(--font-fraunces), serif' }}
              >
                {alt.name}
              </h3>
              <p className={`${MUTED} text-sm leading-[1.5] mb-4`}>{alt.why}</p>
              <div className="font-mono text-[11px] text-[var(--commerce-ink-3)] tracking-[0.04em] uppercase mb-3 leading-relaxed">
                {alt.specs}
              </div>
              <div className={`${INK} text-base font-medium mb-4 mt-auto`}>
                ${alt.price_lo}–${alt.price_hi}/ton
              </div>
              <VerifiedCTAForm
                material_catalog_id={alt.catalog_id}
                material_name={alt.name}
                ctx={ctx}
                label="Order today"
                variant="secondary"
              />
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function ReserveLeadForm({
  material_name,
  material_catalog_id,
  ctx,
  onCancel,
}: {
  material_name: string
  material_catalog_id: string | null
  ctx: ResultCtx
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (submitted) {
    return (
      <div className="rounded-xl bg-[#f0f7f3] border border-[var(--commerce-trust)]/30 p-6 flex items-start gap-4">
        <span className="w-10 h-10 rounded-full bg-[var(--commerce-trust)] text-white flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5" strokeWidth={3} />
        </span>
        <div>
          <h3
            className={`${INK} text-xl mb-1`}
            style={{ fontFamily: 'var(--font-fraunces), serif' }}
          >
            Got it.
          </h3>
          <p className={`${INK} text-base leading-[1.5]`}>
            We&apos;ll reach out within 24 hours at your preferred time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      className="border-t border-[rgba(0,0,0,0.08)] pt-6"
      action={(formData: FormData) => {
        // Inject context fields not in the visible form
        formData.set('market_id', 'a9f89572-50c3-4a59-bbdf-78219c5199d6')
        formData.set('material_name_snapshot', material_name)
        if (material_catalog_id) formData.set('material_catalog_id', material_catalog_id)
        if (ctx.tons) formData.set('tons', ctx.tons)
        if (ctx.zip) formData.set('zip', ctx.zip)
        if (ctx.project_type) formData.set('project_type', ctx.project_type)
        if (ctx.sub_type) formData.set('sub_type', ctx.sub_type)
        if (ctx.delivery_window) formData.set('delivery_window', ctx.delivery_window)
        startTransition(async () => {
          setError(null)
          const result = await submitSourcingRequiredLead(formData)
          if (result.ok) setSubmitted(true)
          else setError(result.error ?? 'Something went wrong. Please try again.')
        })
      }}
    >
      {error && (
        <div className="mb-5 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <div className="grid gap-4">
        <Field name="full_name" label="Full name" required autoComplete="name" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field name="phone" label="Phone" type="tel" autoComplete="tel" />
          <Field name="email" label="Email" type="email" required autoComplete="email" />
        </div>
        <fieldset>
          <legend className={`${INK} text-sm font-semibold mb-2 block`}>
            Best way to reach you
          </legend>
          <div className="flex gap-2">
            {(['phone', 'text', 'email'] as const).map((m) => (
              <label
                key={m}
                className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-[rgba(0,0,0,0.08)] bg-white cursor-pointer hover:border-[var(--commerce-trust)] has-[:checked]:border-[var(--commerce-trust)] has-[:checked]:bg-[#f0f7f3] transition-colors"
              >
                <input
                  type="radio"
                  name="contact_method"
                  value={m}
                  defaultChecked={m === 'phone'}
                  className="sr-only"
                />
                <span className={`${INK} text-sm font-medium capitalize`}>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field name="best_time" label="Best time to reach you" placeholder="e.g. weekday mornings" />
      </div>
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className={`flex-shrink-0 inline-flex items-center justify-center bg-white hover:bg-[#fafafa] ${INK} font-semibold text-base h-12 px-5 rounded-full border border-[rgba(0,0,0,0.08)] transition-colors`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center bg-[var(--commerce-trust)] hover:bg-[var(--commerce-trust)] disabled:bg-[var(--commerce-trust)]/60 text-white font-semibold text-base h-12 rounded-full transition-colors"
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          {pending ? <Loader2 className="animate-spin w-4 h-4" /> : <>Reserve <ArrowRight className="ml-2 w-4 h-4" /></>}
        </button>
      </div>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  autoComplete,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--commerce-ink)] mb-1.5 block">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full h-11 px-4 rounded-lg bg-white border border-[rgba(0,0,0,0.08)] text-[var(--commerce-ink)] focus:outline-none focus:border-[var(--commerce-trust)] focus:ring-2 focus:ring-[var(--commerce-trust)]/10 placeholder:text-[#9ca3af]"
      />
    </label>
  )
}
