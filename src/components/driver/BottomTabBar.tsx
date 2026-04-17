'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard/driver',           key: 'today',    label: 'Today' },
  { href: '/dashboard/driver/find-work', key: 'findwork', label: 'Find work' },
  { href: '/dashboard/driver/money',     key: 'money',    label: 'Money' },
  { href: '/dashboard/driver/trust',     key: 'trust',    label: 'Trust' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav className="em-tab-bar">
      {TABS.map(t => {
        const active = t.href === '/dashboard/driver'
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link key={t.key} href={t.href} className={`em-tab ${active ? 'active' : ''}`} data-tab={t.key}>
            <TabIcon tab={t.key} />
            <span className="em-tab__label">{t.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function TabIcon({ tab }: { tab: string }) {
  switch (tab) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H10v7H5a2 2 0 0 1-2-2z" strokeLinejoin="round" />
        </svg>
      )
    case 'findwork':
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      )
    case 'money':
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 2v20M6 6h9a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'trust':
    default:
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}
