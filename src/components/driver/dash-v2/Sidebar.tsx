'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DRIVER_NAV } from './nav-config'

const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface SidebarProps {
  weekToDate: number
  weekDeltaPct: number
  settlesLabel: string
}

export function Sidebar({ weekToDate, weekDeltaPct, settlesLabel }: SidebarProps) {
  const pathname = usePathname() ?? '/dashboard/driver'
  const deltaArrow = weekDeltaPct >= 0 ? '↑' : '↓'

  return (
    <aside
      className="hidden lg:flex flex-col w-[280px] shrink-0 sticky top-[57px] self-start"
      style={{
        height: 'calc(100vh - 57px)',
        background: '#E9E3D5',
        borderRight: '1px solid #D8D2C4',
      }}
    >
      <nav className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {DRIVER_NAV.map((section) => (
          <div key={section.title}>
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-[#5C645F] font-semibold mb-2.5 px-2.5"
              style={{ fontFamily: MONO }}
            >
              {section.title}
            </div>
            <ul className="space-y-0.5 list-none m-0 p-0">
              {section.items.map((item) => {
                const active = pathname === item.href
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? 'block rounded-[8px] bg-[#15201B] text-[#F1ECE2] px-2.5 py-2 text-[14px] font-semibold'
                          : 'block rounded-[8px] text-[#2A332E] hover:bg-[rgba(20,32,27,0.04)] px-2.5 py-2 text-[14px] font-medium'
                      }
                      style={{ fontFamily: SANS }}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 pt-4 pb-6" style={{ borderTop: '1px solid #D8D2C4' }}>
        <div
          className="text-[10px] uppercase tracking-[0.14em] text-[#5C645F] font-semibold mb-1"
          style={{ fontFamily: MONO }}
        >
          Week to date
        </div>
        <div
          className="text-[28px] font-semibold tracking-[-0.02em] text-[#15201B] leading-none"
          style={{ fontFamily: FRAUNCES }}
        >
          ${weekToDate.toLocaleString()}
        </div>
        <div
          className="text-[11px] mt-1.5 font-semibold"
          style={{
            fontFamily: MONO,
            color: weekDeltaPct >= 0 ? '#1F8A5C' : '#C95F12',
          }}
        >
          {deltaArrow} {Math.abs(weekDeltaPct)}% vs last week
        </div>
        <div
          className="text-[14px] italic text-[#5C645F] mt-1.5"
          style={{ fontFamily: FRAUNCES }}
        >
          {settlesLabel}
        </div>
      </div>
    </aside>
  )
}
