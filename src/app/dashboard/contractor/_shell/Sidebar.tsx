'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; label: string; icon: React.ReactNode; tag?: string }

const NAV: NavItem[] = [
  { href: '/dashboard/contractor',             label: 'Command',     icon: <IconCommand /> },
  { href: '/dashboard/contractor/orders/new',  label: 'Place Order', icon: <IconPlus /> },
  { href: '/dashboard/contractor/track',       label: 'Track Live',  icon: <IconRadar />, tag: 'T2' },
  { href: '/dashboard/contractor/trust',       label: 'Trust',       icon: <IconShield />, tag: 'T2' },
  { href: '/dashboard/contractor/projects',    label: 'Projects',    icon: <IconFolder />, tag: 'T2' },
  { href: '/dashboard/contractor/marketplace', label: 'Marketplace', icon: <IconGrid />, tag: 'T3' },
  { href: '/dashboard/contractor/team',        label: 'Team',        icon: <IconUsers />, tag: 'T3' },
  { href: '/dashboard/contractor/billing',     label: 'Billing',     icon: <IconCoin />, tag: 'T3' },
]

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()
  return (
    <aside className="ec-sidebar">
      <div className="ec-sidebar__brand">
        <span className="ec-sidebar__brand-mark">E</span>
        <span className="ec-sidebar__brand-name">Earth<em>move</em></span>
      </div>
      <nav className="ec-sidebar__nav">
        {NAV.map(item => {
          const active = item.href === '/dashboard/contractor'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} className={`ec-navlink ${active ? 'active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
              {item.tag && <span className="ec-navlink__tag">{item.tag}</span>}
            </Link>
          )
        })}
      </nav>
      <div className="ec-sidebar__foot">{orgName}</div>
    </aside>
  )
}

function IconCommand() { return <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H10v7H5a2 2 0 0 1-2-2z" strokeLinejoin="round"/></svg> }
function IconPlus()    { return <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg> }
function IconRadar()   { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg> }
function IconShield()  { return <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round"/><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function IconFolder()  { return <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinejoin="round"/></svg> }
function IconGrid()    { return <svg viewBox="0 0 24 24"><rect x="3" y="3"  width="7" height="7" rx="1"/><rect x="14" y="3"  width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconUsers()   { return <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0" strokeLinecap="round"/><circle cx="17" cy="6" r="3"/><path d="M17 13a5 5 0 0 1 5 5" strokeLinecap="round"/></svg> }
function IconCoin()    { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 10h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h5" strokeLinecap="round" strokeLinejoin="round"/></svg> }
