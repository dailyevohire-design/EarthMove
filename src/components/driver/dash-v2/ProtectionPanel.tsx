const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// Hardcoded per artboard. Followup #35: wire Groundcheck recent lookups
// to groundcheck_lookups table (introduced in T2). Followup #34: lien
// filings table + new-filing flow.
const RECENT_LOOKUPS = [
  'Highland Park Custom Homes',
  'BRT Civil Construction',
  'Tarrant Paving LLC',
  'DFW Site Prep Inc',
  'Lone Star Earthworks',
]

export function ProtectionPanel() {
  return (
    <section className="mt-9 grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
      <GroundcheckCard />
      <LienFilingsCard />
    </section>
  )
}

function GroundcheckCard() {
  return (
    <div
      className="bg-white rounded-[18px] p-7 flex flex-col gap-4"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1F8A5C]"
        style={{ fontFamily: SANS }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#1F8A5C]" />
        Groundcheck a project
      </span>
      <h3
        className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
        style={{ fontFamily: FRAUNCES }}
      >
        Vet a contractor <em className="italic font-medium">before</em> you load.
      </h3>
      <p className="text-[14px] text-[#2A332E] leading-[1.55] m-0">
        Pulls TX Secretary of State entity record, 90-day lien history, FMCSA carrier safety, and EarthMove&apos;s own dispatch payment history. Free, unlimited, entity-only.
      </p>

      <div
        className="rounded-[14px] p-3.5 mt-1"
        style={{ border: '1px solid #D8D2C4', background: '#FFFFFF' }}
      >
        <input
          type="text"
          placeholder="Contractor LLC name, EIN, or project address"
          className="w-full bg-transparent outline-none text-[13px] text-[#15201B] placeholder:text-[#5C645F]"
          style={{ fontFamily: MONO }}
        />
      </div>

      <div>
        <div
          className="text-[10px] uppercase tracking-[0.10em] text-[#5C645F] font-semibold mb-2"
          style={{ fontFamily: MONO }}
        >
          Recent lookups
        </div>
        <div className="flex flex-wrap gap-2">
          {RECENT_LOOKUPS.map((name) => (
            <a
              key={name}
              href="#gc-lookup"
              className="inline-flex text-[11px] text-[#2A332E] hover:text-[#15201B] hover:border-[#5C645F] rounded-[6px] px-2.5 py-1.5 transition-colors"
              style={{ background: '#E9E3D5', border: '1px solid #D8D2C4', fontFamily: MONO }}
            >
              {name}
            </a>
          ))}
        </div>
      </div>

      <div
        className="mt-auto pt-4 text-[10px] uppercase tracking-[0.10em] text-[#5C645F] font-semibold"
        style={{ borderTop: '1px solid #D8D2C4', fontFamily: MONO }}
      >
        Entity-only · FCRA-safe · LLCs, corps, partnerships
      </div>
    </div>
  )
}

function LienFilingsCard() {
  return (
    <div
      className="rounded-[18px] p-7 flex flex-col gap-4 text-[#F1ECE2]"
      style={{
        background: '#0F2920',
        border: '1px solid #14322A',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#E0A52A]"
        style={{ fontFamily: SANS }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#E0A52A]" />
        Lien intent filings
      </span>
      <h3
        className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] text-white m-0"
        style={{ fontFamily: FRAUNCES }}
      >
        Unpaid load? <em className="italic font-medium">File intent</em> in 90 seconds.
      </h3>
      <p className="text-[14px] text-[#A9B4AC] leading-[1.55] m-0">
        Texas Property Code Ch. 56 covers aggregate haulers — file a notice of intent within the statutory window and you preserve your lien on the project. EarthMove generates the form, mails certified, stores the green card.
      </p>

      <div
        className="grid grid-cols-3 gap-3 mt-1 rounded-[12px] p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <DarkCell label="Active filings" value="0" />
        <DarkCell label="Resolved this year" value="0" />
        <DarkCell label="Avg recovery" value="—" />
      </div>

      <button
        type="button"
        className="self-start inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] px-[18px] py-3 bg-[#E5701B] text-white border border-transparent hover:bg-[#C95F12] transition-colors mt-1"
        style={{ fontFamily: SANS }}
      >
        Start a new filing
      </button>

      <div
        className="text-[11px] text-[#A9B4AC] tracking-[0.04em]"
        style={{ fontFamily: MONO }}
      >
        Texas only at launch · Colorado + Arizona Q3 2026
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }} className="pt-3">
        <p
          className="text-[10px] italic text-[#A9B4AC] leading-[1.55] m-0"
          style={{ fontFamily: MONO }}
        >
          Filing assistance, not legal representation. EarthMove generates statutory notice forms and provides certified-mail service. Consult counsel for litigation or contested liens.
        </p>
      </div>
    </div>
  )
}

function DarkCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.10em] text-[#A9B4AC] font-semibold"
        style={{ fontFamily: MONO }}
      >
        {label}
      </div>
      <div
        className="text-[20px] font-semibold tracking-[-0.015em] text-white mt-0.5"
        style={{ fontFamily: FRAUNCES }}
      >
        {value}
      </div>
    </div>
  )
}
