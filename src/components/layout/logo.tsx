import Link from 'next/link'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md'
}

/**
 * EarthMove logo — minimalist mark + refined wordmark.
 *
 * Mark: 3 stacked wedge bars representing stratified earth/aggregate layers.
 * Wordmark: Uppercase, tight tracking, single color, medium weight.
 * Inspired by Stripe, Linear, Palantir — no generic icons, no two-tone splits.
 */
export function Logo({ variant = 'dark', size = 'md' }: LogoProps) {
  const textColor = variant === 'light' ? 'text-white' : 'text-gray-900'
  const markColor = variant === 'light' ? '#ffffff' : '#059669' // emerald-600
  const markSize = size === 'sm' ? 18 : 22
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]'

  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="EarthMove home">
      <Mark size={markSize} color={markColor} />
      <span
        className={`${textColor} ${textSize} font-semibold uppercase tracking-[0.22em] leading-none transition-colors`}
      >
        EARTHMOVE
      </span>
    </Link>
  )
}

/**
 * The mark — 3 descending wedges forming an abstract "E" / earth-strata glyph.
 * Clean geometry, no rounded containers, scales perfectly at any size.
 */
export function LogoMark({ size = 18, color = '#059669' }: { size?: number; color?: string }) {
  return <Mark size={size} color={color} />
}

function Mark({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* Top bar — widest, angled */}
      <path
        d="M3 5 L21 5 L17 9 L3 9 Z"
        fill={color}
      />
      {/* Middle bar — medium */}
      <path
        d="M3 11 L17 11 L14 15 L3 15 Z"
        fill={color}
        opacity="0.75"
      />
      {/* Bottom bar — shortest */}
      <path
        d="M3 17 L13 17 L11 21 L3 21 Z"
        fill={color}
        opacity="0.5"
      />
    </svg>
  )
}
