'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  loadNumber?: number | null
  distanceMiles?: number | null
  destination: string
  payDollars: number
}

export function ActiveLoadPill({ loadNumber, distanceMiles, destination, payDollars }: Props) {
  const pathname = usePathname()
  if (pathname === '/dashboard/driver') return null   // hide on Today

  const label = loadNumber != null ? `Load ${loadNumber}` : 'Active load'
  const dist  = distanceMiles != null ? `${distanceMiles} mi to ${destination}` : destination

  return (
    <Link href="/dashboard/driver" className="em-active-pill">
      <div className="em-active-pill__dot" />
      <div className="em-active-pill__text">
        {label}  ·  {dist}  ·  <span>${payDollars.toLocaleString()}</span>
      </div>
      <div className="em-active-pill__arrow">›</div>
    </Link>
  )
}
