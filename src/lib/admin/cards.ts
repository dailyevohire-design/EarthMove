export type InterventionCard = {
  id: string
  rule_key: string
  entity_type: string
  entity_id: string | null
  severity: 'info' | 'warn' | 'critical'
  title: string
  body: string | null
  ai_summary: string | null
  status: 'open' | 'claimed' | 'snoozed' | 'resolved' | 'dismissed'
  claimed_by: string | null
  claimed_at: string | null
  snoozed_until: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  payload: Record<string, unknown>
  dedup_key: string | null
  created_at: string
  updated_at: string
}

export type CardAction =
  | { action: 'claim' }
  | { action: 'snooze'; duration_minutes: number }
  | { action: 'resolve'; note?: string }
  | { action: 'dismiss'; note?: string }
  | { action: 'wake' }

export const SEVERITY_RANK: Record<'critical' | 'warn' | 'info', number> = {
  critical: 0,
  warn: 1,
  info: 2,
}

export function severityClasses(s: 'info' | 'warn' | 'critical'): string {
  if (s === 'critical') return 'bg-red-100 text-red-800 border-red-200'
  if (s === 'warn') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
