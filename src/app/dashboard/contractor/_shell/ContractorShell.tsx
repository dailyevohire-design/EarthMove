'use client'

import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

type Props = {
  orgName: string
  userDisplay: string
  initials: string
  alertCount: number
  children: React.ReactNode
}

export function ContractorShell({ orgName, userDisplay, initials, alertCount, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--bone-50)] overflow-hidden">
      <div className="ec-app">
        <Sidebar orgName={orgName} />
        <TopBar initials={initials} userDisplay={userDisplay} alertCount={alertCount} />
        <main className="ec-main">
          <div className="ec-main__inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
