const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface StatusStripProps {
  onDutySince: string
  loadsToday: number
  tonsToday: number
  payAccruedToday: number
}

export function StatusStrip({ onDutySince, loadsToday, tonsToday, payAccruedToday }: StatusStripProps) {
  return (
    <section
      className="bg-white rounded-[18px] p-5 grid grid-cols-2 md:grid-cols-4 gap-y-3.5 gap-x-[22px]"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <Cell label="On duty since" value={onDutySince} />
      <Cell label="Loads today" value={loadsToday.toString()} />
      <Cell label="Tons today" value={tonsToday.toFixed(1)} />
      <Cell label="Pay accrued today" value={`$${payAccruedToday.toLocaleString()}`} accent="orange" />
    </section>
  )
}

function Cell({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  accent?: 'orange'
}) {
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
        className="font-semibold text-[22px] leading-[1.15] tracking-[-0.015em] mt-0.5"
        style={{ fontFamily: FRAUNCES, color: valueColor }}
      >
        {value}
        {suffix && (
          <small
            className="text-[11px] font-medium text-[#5C645F] ml-1"
            style={{ fontFamily: SANS }}
          >
            {suffix}
          </small>
        )}
      </div>
    </div>
  )
}
