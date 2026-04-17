export const PHASES = [
  'ready',
  'en_route_pickup',
  'loading',
  'en_route_site',
  'dumped',
  'ticket_submitted',
] as const

export type Phase = (typeof PHASES)[number]

const NEXT: Record<Phase, Phase | null> = {
  ready:             'en_route_pickup',
  en_route_pickup:   'loading',
  loading:           'en_route_site',
  en_route_site:     'dumped',
  dumped:            'ticket_submitted',
  ticket_submitted:  null,
}

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASES as readonly string[]).includes(v)
}

export function nextPhase(current: Phase): Phase | null {
  return NEXT[current]
}

export function isLegalTransition(from: Phase, to: Phase): boolean {
  return NEXT[from] === to
}

export const SWIPE_LABEL: Record<Phase, string> = {
  ready:            "Swipe — I'm at the pickup",
  en_route_pickup:  "Swipe — loaded & weighed",
  loading:          "Swipe — I'm at the site",
  en_route_site:    'Swipe — dumped',
  dumped:           'Swipe — submit ticket',
  ticket_submitted: 'Load complete',
}

export const BEAT_FOR_PHASE: Record<Phase, 'pickup' | 'deliver' | 'ticket'> = {
  ready:            'pickup',
  en_route_pickup:  'pickup',
  loading:          'deliver',
  en_route_site:    'deliver',
  dumped:           'ticket',
  ticket_submitted: 'ticket',
}
