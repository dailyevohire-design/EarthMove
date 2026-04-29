const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// Hardcoded per artboard. Followup #39: query dispatches WHERE driver_id =
// current AND completed_at >= week_start, ordered by completed_at DESC.
type RunRow = {
  date: string
  material: string
  route: string
  tons: number
  pay: number
  status: 'paid' | 'pending'
  paidLabel?: string
}

const RUNS: RunRow[] = [
  // current week (pending Apr 30)
  { date: 'Thu Apr 23', material: 'Flex Base', route: 'Singleton → Frisco', tons: 14, pay: 142, status: 'pending' },
  { date: 'Wed Apr 22', material: '#57 Stone', route: 'Mountain Creek → Plano', tons: 22, pay: 118, status: 'pending' },
  { date: 'Wed Apr 22', material: 'Concrete Sand', route: 'Eagle Ford → Mansfield', tons: 14, pay: 96, status: 'pending' },
  { date: 'Tue Apr 21', material: 'Crushed Limestone', route: 'Forney → Garland', tons: 22, pay: 134, status: 'pending' },
  // last week (paid Apr 17)
  { date: 'Fri Apr 17', material: 'Flex Base', route: 'Singleton → Carrollton', tons: 14, pay: 142, status: 'paid', paidLabel: 'PAID FRI APR 17' },
  { date: 'Fri Apr 17', material: '#57 Stone', route: 'Mountain Creek → Allen', tons: 22, pay: 118, status: 'paid', paidLabel: 'PAID FRI APR 17' },
  { date: 'Thu Apr 16', material: 'Rip Rap', route: 'Forney → Wylie', tons: 22, pay: 168, status: 'paid', paidLabel: 'PAID FRI APR 17' },
  { date: 'Wed Apr 15', material: 'Concrete Sand', route: 'Eagle Ford → Lewisville', tons: 14, pay: 96, status: 'paid', paidLabel: 'PAID FRI APR 17' },
  { date: 'Tue Apr 14', material: 'Crushed Limestone', route: 'Singleton → Irving', tons: 14, pay: 122, status: 'paid', paidLabel: 'PAID FRI APR 17' },
  { date: 'Mon Apr 13', material: '#57 Stone', route: 'Mountain Creek → McKinney', tons: 22, pay: 134, status: 'paid', paidLabel: 'PAID FRI APR 17' },
]

export function WeekRunsTable() {
  return (
    <section className="mt-9">
      <div className="flex flex-col gap-2 mb-3.5">
        <span
          className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E]"
          style={{ fontFamily: SANS }}
        >
          <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
          This week · Mon Apr 20 – today
        </span>
        <h2
          className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
          style={{ fontFamily: FRAUNCES }}
        >
          Settles <em className="italic font-medium">this Friday</em>.
        </h2>
      </div>

      <div
        className="bg-white rounded-[18px] overflow-hidden"
        style={{ border: '1px solid #D8D2C4' }}
      >
        <div
          className="grid grid-cols-[120px_140px_1fr_70px_80px_180px] items-center px-5 py-2.5 text-[10px] uppercase tracking-[0.10em] text-[#5C645F] font-semibold"
          style={{ background: '#E9E3D5', fontFamily: MONO }}
        >
          <div>Date</div>
          <div>Material</div>
          <div>Route</div>
          <div className="text-right">Tons</div>
          <div className="text-right">Pay</div>
          <div className="text-right">Status</div>
        </div>

        <div>
          {RUNS.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[120px_140px_1fr_70px_80px_180px] items-center px-5 py-3 text-[13px] text-[#2A332E]"
              style={{ borderTop: i === 0 ? 'none' : '1px solid #D8D2C4', fontFamily: SANS }}
            >
              <div className="text-[12px] text-[#5C645F]" style={{ fontFamily: MONO }}>
                {row.date}
              </div>
              <div className="font-semibold text-[#15201B]">{row.material}</div>
              <div className="text-[#2A332E]">{row.route}</div>
              <div className="text-right" style={{ fontFamily: MONO }}>{row.tons}</div>
              <div className="text-right font-semibold text-[#15201B]" style={{ fontFamily: MONO }}>
                ${row.pay}
              </div>
              <div className="flex justify-end">
                {row.status === 'paid' ? (
                  <span
                    className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#1F8A5C] text-white border border-transparent rounded-[5px] px-2.5 py-1 whitespace-nowrap"
                    style={{ fontFamily: MONO }}
                  >
                    {row.paidLabel}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] bg-white text-[#15201B] border border-[#D8D2C4] rounded-[5px] px-2.5 py-1 whitespace-nowrap"
                    style={{ fontFamily: MONO }}
                  >
                    PENDING · FRI APR 30
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-[1fr_1fr_1fr] items-center px-5 py-4 text-[12px]"
          style={{ background: '#E9E3D5', borderTop: '1px solid #D8D2C4', fontFamily: MONO }}
        >
          <div className="font-semibold text-[#15201B] uppercase tracking-[0.10em]">Week to date</div>
          <div className="text-center text-[#2A332E]">17 loads · 224 t · $2,180</div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="text-[#5C645F] uppercase tracking-[0.06em] text-[11px]">
              Settles Friday Apr 30
            </div>
            <a
              href="#download-statement"
              className="text-[10px] uppercase tracking-[0.06em] text-[#E5701B] hover:underline font-semibold"
            >
              Download statement preview →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
