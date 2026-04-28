'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'
import { ArrowRight } from 'lucide-react'

interface Props {
  materialSlug: string
  materialName: string
  unit: 'ton' | 'cubic_yard'
  pricePerUnit: number
  defaultQty: number
}

export function StickyRail({ materialSlug, materialName, unit, pricePerUnit, defaultQty }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const orderHref = `/contact?material=${encodeURIComponent(materialSlug)}&qty=${defaultQty}&action=order`

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        transform: visible ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 220ms ease',
        pointerEvents: visible ? 'auto' : 'none',
        background: 'var(--em-panel)',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div
        className="container-main flex items-center gap-4 py-3"
        style={{ color: '#fff' }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.14em] truncate"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {materialName}
          </div>
          <div className="text-base font-semibold tabular-nums">
            {formatCurrency(pricePerUnit)}{' '}
            <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.65)' }}>
              / {unitLabel(unit, 1)}
            </span>
          </div>
        </div>

        <Link
          href={orderHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--em-orange)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 16px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          Place order <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
