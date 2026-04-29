import Link from 'next/link'

const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface TopBarProps {
  driverName: string
  truckClassLabel: string
  dotNumber: string
  onDuty: boolean
}

export function TopBar({ driverName, truckClassLabel, dotNumber, onDuty }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-[5] w-full"
      style={{ background: '#F1ECE2', borderBottom: '1px solid #D8D2C4' }}
    >
      <div className="flex items-center justify-between gap-6 px-10 py-[14px]">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard/driver"
            className="inline-flex items-baseline text-[22px] font-bold tracking-[-0.01em] text-[#15201B]"
            style={{ fontFamily: FRAUNCES }}
          >
            <span aria-hidden className="inline-block w-[10px] h-[10px] rounded-[2px] bg-[#1F8A5C] mr-2 -translate-y-px" />
            EarthMove<span className="text-[#1F8A5C]">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <span className="text-[15px] font-semibold text-[#15201B]" style={{ fontFamily: SANS }}>
              {driverName}
            </span>
            <Lozenge>{truckClassLabel}</Lozenge>
            <Lozenge>DOT {dotNumber}</Lozenge>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DutyToggle onDuty={onDuty} />
          <Link
            href="/api/auth/sign-out"
            className="text-[11px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#15201B] font-semibold"
            style={{ fontFamily: MONO }}
          >
            Sign out
          </Link>
        </div>
      </div>
    </header>
  )
}

function Lozenge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] bg-white text-[#15201B] border border-[#D8D2C4] rounded-[5px] px-2.5 py-1 whitespace-nowrap"
      style={{ fontFamily: MONO }}
    >
      {children}
    </span>
  )
}

function DutyToggle({ onDuty }: { onDuty: boolean }) {
  const segBase =
    'px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] inline-flex items-center gap-1.5'
  const onCls = onDuty
    ? 'bg-[#1F8A5C] text-white'
    : 'bg-transparent text-[#5C645F] hover:text-[#15201B]'
  const offCls = !onDuty
    ? 'bg-[#15201B] text-[#F1ECE2]'
    : 'bg-transparent text-[#5C645F] hover:text-[#15201B]'
  return (
    <div
      className="inline-flex rounded-full border border-[#D8D2C4] bg-white p-0.5"
      style={{ fontFamily: MONO }}
    >
      <span className={`${segBase} rounded-full ${onCls}`}>
        {onDuty && <span aria-hidden className="w-[5px] h-[5px] rounded-full bg-[#2DB37A]" />}
        On duty
      </span>
      <span className={`${segBase} rounded-full ${offCls}`}>Off duty</span>
    </div>
  )
}
