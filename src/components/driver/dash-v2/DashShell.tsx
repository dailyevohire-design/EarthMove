import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'

const SANS = "'Inter', -apple-system, system-ui, sans-serif"

export interface DashShellProps {
  driverName: string
  truckClassLabel: string
  dotNumber: string
  onDuty: boolean
  weekToDate: number
  weekDeltaPct: number
  settlesLabel: string
  children: ReactNode
}

// Wraps every authed driver route in fullscreen chrome (z-[60], inset-0).
// Followup #36: reconcile mobile truck-cab UX vs. V2 desktop shell — likely
// route truck-cab to /dashboard/driver/today and keep V2 at /dashboard/driver.
export function DashShell({
  driverName,
  truckClassLabel,
  dotNumber,
  onDuty,
  weekToDate,
  weekDeltaPct,
  settlesLabel,
  children,
}: DashShellProps) {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-auto flex flex-col"
      style={{ background: '#F1ECE2', color: '#15201B', fontFamily: SANS }}
    >
      <TopBar
        driverName={driverName}
        truckClassLabel={truckClassLabel}
        dotNumber={dotNumber}
        onDuty={onDuty}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          weekToDate={weekToDate}
          weekDeltaPct={weekDeltaPct}
          settlesLabel={settlesLabel}
        />
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
