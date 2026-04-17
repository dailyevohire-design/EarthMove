'use client'

import { useEffect } from 'react'
import { ActiveLoadPill } from '@/components/driver/ActiveLoadPill'
import { BottomTabBar }   from '@/components/driver/BottomTabBar'
import { EarningsMoment } from '@/components/driver/EarningsMoment'
import { OfflineBanner }  from '@/components/driver/OfflineBanner'
import { applyBodyClasses, readLocal, loadFromDb, saveToDb } from '@/lib/driver/prefs'

type ActiveLoad = {
  id: string
  destination: string
  distanceMiles: number | null
  payDollars: number
  loadNumber: number | null
} | null

type Props = {
  driverId: string
  firstName: string
  todayEarnings: number
  activeLoad: ActiveLoad
  children: React.ReactNode
}

export function DriverShell({ driverId, firstName, todayEarnings, activeLoad, children }: Props) {
  useEffect(() => {
    applyBodyClasses(readLocal())
    loadFromDb(driverId).then(applyBodyClasses).catch(() => {})
    return () => {
      document.body.classList.remove('glove', 'dark')
    }
  }, [driverId])

  return (
    <div className="fixed inset-0 z-50 bg-[color:var(--bone-50)] overflow-hidden">
      <div className="em-app">
        <div className="em-header">
          <div>
            <div className="em-header__greeting">{greeting()}</div>
            <div className="em-header__title">{firstName}</div>
          </div>
          <div className="em-header__right">
            <div className="em-header__earn-label">Today</div>
            <div className="em-header__earn">
              ${todayEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="em-header__menu">
              <button
                className="em-chip-btn live"
                onClick={() => toggleGlove(driverId)}
                title="Glove mode"
              >
                On shift
              </button>
            </div>
          </div>
        </div>

        <div className="em-pages">
          <section className="em-page active">
            <div className="em-scroll">
              {children}
            </div>
          </section>
        </div>

        {activeLoad && (
          <ActiveLoadPill
            loadNumber={activeLoad.loadNumber}
            distanceMiles={activeLoad.distanceMiles}
            destination={activeLoad.destination}
            payDollars={activeLoad.payDollars}
          />
        )}
        <OfflineBanner />
        <BottomTabBar />
        <EarningsMoment />
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// TODO: persist glove/dark writes before allowing navigation, or migrate toggle state to server component cookie. Current flow has a race if the driver navigates before saveToDb resolves.
async function toggleGlove(driverId: string) {
  const next = !document.body.classList.contains('glove')
  document.body.classList.toggle('glove', next)
  await saveToDb(driverId, { glove_mode: next }).catch(() => {})
}
