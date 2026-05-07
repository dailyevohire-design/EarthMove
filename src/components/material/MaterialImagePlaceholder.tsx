import { Logo } from '@/components/logo'

export function MaterialImagePlaceholder({
  label = 'Product image coming soon',
  markSize = 44,
}: {
  label?: string
  markSize?: number
}) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'var(--m-cream, #F5F1E8)',
        padding: '0 16px',
      }}
    >
      <Logo variant="mark" size={markSize} theme="positive" />
      <span
        style={{
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6B7280',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  )
}
