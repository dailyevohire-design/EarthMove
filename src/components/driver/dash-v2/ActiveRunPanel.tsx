import type { ReactNode } from 'react'

const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface ActiveRunPanelProps {
  dispatchId: string | null
  material: string
  tons: number | null
  pickupYard: string
  dropCity: string
  totalMiles: number | null
  pickupEta: string
  dropEta: string
  milesToDrop: number | null
  payThisLoad: number | null
  // followup #36: when null, render hardcoded artboard placeholder + a
  // "Capture scale ticket" stub button. When present, embed the real
  // SwipeToConfirm via TodayLoadPanel — preserves WAL behavior.
  swipeSlot?: ReactNode
}

export function ActiveRunPanel({
  dispatchId,
  material,
  tons,
  pickupYard,
  dropCity,
  totalMiles,
  pickupEta,
  dropEta,
  milesToDrop,
  payThisLoad,
  swipeSlot,
}: ActiveRunPanelProps) {
  const dispatchLabel = dispatchId ? `DSP-${dispatchId.slice(0, 4).toUpperCase()}` : 'DSP-—'
  return (
    <section
      className="bg-white rounded-[18px] grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <div className="p-6 lg:p-7 flex flex-col gap-3">
        <span
          className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.10em] text-[#2A332E]"
          style={{ fontFamily: MONO }}
        >
          <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
          Active run · {dispatchLabel}
        </span>
        <h3
          className="text-[24px] sm:text-[28px] lg:text-[30px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
          style={{ fontFamily: FRAUNCES }}
        >
          {material}{tons != null && ` · ${tons.toFixed(0)} t`}
        </h3>
        <p className="text-[14px] text-[#2A332E] leading-[1.55] m-0">
          {pickupYard} → {dropCity}
          {totalMiles != null && ` · ${totalMiles.toFixed(1)} mi total`}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-5 mt-2 pt-4" style={{ borderTop: '1px solid #D8D2C4' }}>
          <Cell label="Pickup ETA" value={pickupEta} />
          <Cell label="Drop ETA" value={dropEta} />
          <Cell label="Miles to drop" value={milesToDrop != null ? milesToDrop.toFixed(1) : '—'} />
          <Cell label="Pay this load" value={payThisLoad != null ? `$${payThisLoad.toLocaleString()}` : '—'} accent="orange" />
        </div>

        <div className="mt-4">
          {swipeSlot ? (
            swipeSlot
          ) : (
            <div className="flex flex-wrap gap-2.5 items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] px-[18px] py-3 bg-[#E5701B] text-white border border-transparent hover:bg-[#C95F12] transition-colors"
                style={{ fontFamily: SANS }}
              >
                Capture scale ticket
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] px-[18px] py-3 bg-transparent text-[#15201B] border border-[#15201B] hover:bg-[#15201B] hover:text-[#F1ECE2] transition-colors"
                style={{ fontFamily: SANS }}
              >
                Open turn-by-turn
              </button>
            </div>
          )}
        </div>

        <a
          href="#report-issue"
          className="text-[11px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#E5701B] font-semibold mt-2 inline-block"
          style={{ fontFamily: MONO }}
        >
          Report issue with this load →
        </a>
      </div>

      <div className="p-6 lg:py-7 lg:pr-7 lg:pl-0">
        <div
          className="relative w-full h-[220px] rounded-[14px] overflow-hidden"
          style={{
            background: '#14322A',
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <svg viewBox="0 0 320 220" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <path
              d="M 36 168 C 90 152, 130 140, 158 110 S 230 56, 286 50"
              fill="none"
              stroke="#E5701B"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* start pin */}
            <g transform="translate(36 168)">
              <circle r="9" fill="#FFFFFF" stroke="#15201B" strokeWidth="1" />
              <circle r="4" fill="#2DB37A" />
            </g>
            {/* end pin */}
            <g transform="translate(286 50)">
              <circle r="9" fill="#FFFFFF" stroke="#15201B" strokeWidth="1" />
              <circle r="4" fill="#E5701B" />
            </g>
          </svg>
          <span
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#1F8A5C] text-white border border-transparent rounded-[5px] px-2.5 py-1.5"
            style={{ fontFamily: MONO }}
          >
            {milesToDrop != null ? `${milesToDrop.toFixed(1)} MI TO DROP` : 'EN ROUTE'}
          </span>
        </div>
      </div>
    </section>
  )
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: 'orange' }) {
  const valueColor = accent === 'orange' ? '#E5701B' : '#15201B'
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.10em] text-[#5C645F] font-semibold"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className="font-semibold text-[20px] leading-[1.15] tracking-[-0.015em] mt-0.5"
        style={{ fontFamily: FRAUNCES, color: valueColor }}
      >
        {value}
      </div>
    </div>
  )
}

export function ActiveRunEmpty() {
  return (
    <section
      className="bg-white rounded-[18px] p-6 lg:p-7 flex flex-col gap-3"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.10em] text-[#5C645F]"
        style={{ fontFamily: MONO }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#5C645F]" />
        Active run · none
      </span>
      <h3
        className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
        style={{ fontFamily: FRAUNCES }}
      >
        No active run.
      </h3>
      <p className="text-[14px] text-[#2A332E] leading-[1.55] m-0 max-w-[52ch]">
        Pick up your next load from the available queue below, or check schedule + preferences if today is a blackout day.
      </p>
    </section>
  )
}
