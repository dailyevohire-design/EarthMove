const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// Hardcoded for this commit. Followup #38: query ready-status dispatches in
// the driver's market with H3 corridor filter, plus the trust signals.
type TrustSignal =
  | { kind: 'gc-verified'; activeLiens: number; avgPayDays: number }
  | { kind: 'unchecked' }

type AvailableLoad = {
  id: string
  pay: number
  material: string
  tons: number
  pickupYard: string
  dropCity: string
  totalMiles: number
  pickupTime: string
  pickupMiles: number
  dropTime: string
  dropMiles: number
  trust: TrustSignal
}

const LOADS: AvailableLoad[] = [
  {
    id: 'load-1',
    pay: 142,
    material: 'Flex Base',
    tons: 14,
    pickupYard: 'Singleton Yard',
    dropCity: 'Frisco',
    totalMiles: 28.4,
    pickupTime: '7:15',
    pickupMiles: 6.4,
    dropTime: '8:00',
    dropMiles: 22.0,
    trust: { kind: 'gc-verified', activeLiens: 0, avgPayDays: 14 },
  },
  {
    id: 'load-2',
    pay: 118,
    material: '#57 Stone',
    tons: 22,
    pickupYard: 'Mountain Creek',
    dropCity: 'Plano',
    totalMiles: 31.2,
    pickupTime: '7:45',
    pickupMiles: 8.1,
    dropTime: '8:40',
    dropMiles: 23.1,
    trust: { kind: 'unchecked' },
  },
  {
    id: 'load-3',
    pay: 96,
    material: 'Concrete Sand',
    tons: 14,
    pickupYard: 'Eagle Ford Yard',
    dropCity: 'Mansfield',
    totalMiles: 21.6,
    pickupTime: '8:20',
    pickupMiles: 4.4,
    dropTime: '9:05',
    dropMiles: 17.2,
    trust: { kind: 'gc-verified', activeLiens: 0, avgPayDays: 9 },
  },
]

export function AvailableLoads() {
  return (
    <section className="mt-9">
      <div className="flex justify-between items-end gap-3.5 mb-3.5">
        <div className="flex flex-col gap-2">
          <span
            className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E]"
            style={{ fontFamily: SANS }}
          >
            <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
            Available · DFW · refreshed 2 min ago
          </span>
          <h2
            className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
            style={{ fontFamily: FRAUNCES }}
          >
            <em className="italic font-medium">3 loads</em> ready to claim.
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[18px]">
        {LOADS.map((load) => (
          <LoadCard key={load.id} load={load} />
        ))}
      </div>
    </section>
  )
}

function LoadCard({ load }: { load: AvailableLoad }) {
  return (
    <article
      className="bg-white rounded-[18px] p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(20,32,27,0.10)]"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4
            className="text-[20px] font-semibold tracking-[-0.015em] leading-[1.15] text-[#15201B] m-0"
            style={{ fontFamily: FRAUNCES }}
          >
            {load.material} · {load.tons} t
          </h4>
          <p className="text-[14px] text-[#2A332E] m-0 mt-1.5">
            {load.pickupYard} → {load.dropCity} · {load.totalMiles.toFixed(1)} mi total
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] bg-[#1F8A5C] text-white border border-transparent rounded-[5px] px-2.5 py-1.5 whitespace-nowrap"
          style={{ fontFamily: MONO }}
        >
          ${load.pay}
        </span>
      </div>

      <div className="flex flex-col gap-1" style={{ fontFamily: MONO }}>
        <div className="text-[11px] tracking-[0.04em] text-[#5C645F]">
          Pickup {load.pickupTime} · {load.pickupMiles.toFixed(1)} mi
        </div>
        <div className="text-[11px] tracking-[0.04em] text-[#5C645F]">
          Drop {load.dropTime} · {load.dropMiles.toFixed(1)} mi
        </div>
      </div>

      <TrustRow signal={load.trust} />

      <div className="flex items-center justify-between gap-2.5 mt-1">
        <button
          type="button"
          className="text-[13px] font-semibold text-[#5C645F] hover:text-[#15201B] underline-offset-2"
          style={{ fontFamily: SANS }}
        >
          Decline
        </button>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="text-[10px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#E5701B] font-semibold"
            style={{ fontFamily: MONO }}
          >
            Run Groundcheck
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[13px] px-4 py-2.5 bg-[#E5701B] text-white border border-transparent hover:bg-[#C95F12] transition-colors"
            style={{ fontFamily: SANS }}
          >
            Accept
          </button>
        </div>
      </div>
    </article>
  )
}

function TrustRow({ signal }: { signal: TrustSignal }) {
  if (signal.kind === 'gc-verified') {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2.5 rounded-[12px]"
        style={{ background: '#E9E3D5' }}
      >
        <span aria-hidden className="w-[7px] h-[7px] rounded-full bg-[#1F8A5C] shrink-0" />
        <span className="text-[12px] text-[#2A332E]" style={{ fontFamily: SANS }}>
          GC verified · {signal.activeLiens} active liens · {signal.avgPayDays} d avg pay
        </span>
      </div>
    )
  }
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2.5 rounded-[12px]"
      style={{ background: '#E9E3D5' }}
    >
      <span aria-hidden className="w-[7px] h-[7px] rounded-full bg-[#E0A52A] shrink-0" />
      <a
        href="#run-groundcheck"
        className="text-[12px] text-[#E5701B] hover:underline font-semibold"
        style={{ fontFamily: SANS }}
      >
        Run Groundcheck on this contractor →
      </a>
    </div>
  )
}
