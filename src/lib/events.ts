// src/lib/events.ts
// Append-only entity-event emitter for the operator command center.
//
// Writes go through the service-role admin client (RLS bypass). Reads are
// admin-gated via is_admin() at the policy layer; never call this from the
// browser bundle.
//
// Two entry points:
//   emitEvent()      — awaitable, throws on failure. Use when correctness matters.
//   fireAndForget()  — returns immediately, logs failures. Use everywhere else.

import { createAdminClient } from './supabase/server'

// ── Constant tables (schema-aligned — keep CHECK constraints in sync) ────

export const EntityType = {
  ORDER:    'order',
  CUSTOMER: 'customer',
  GC:       'gc',
  DRIVER:   'driver',
  DISPATCH: 'dispatch',
  SESSION:  'session',
  SUPPLIER: 'supplier',
  SYSTEM:   'system',
} as const
export type EntityType = (typeof EntityType)[keyof typeof EntityType]

export const Severity = {
  DEBUG:    'debug',
  INFO:     'info',
  WARN:     'warn',
  CRITICAL: 'critical',
} as const
export type Severity = (typeof Severity)[keyof typeof Severity]

export const EventSource = {
  WEB:     'web',
  STRIPE:  'stripe',
  TWILIO:  'twilio',
  INNGEST: 'inngest',
  MANUAL:  'manual',
  SYSTEM:  'system',
} as const
export type EventSource = (typeof EventSource)[keyof typeof EventSource]

// Canonical event-type registry. Strings are intentional (text column, not enum)
// so call sites can use unregistered values during incremental rollout.
export const EventType = {
  ORDER_PLACED:           'order.placed',
  ORDER_FIRST_TIME:       'order.first_time',
  ORDER_DRAFT_SAVED:      'order.draft_saved',
  ORDER_DRAFT_ABANDONED:  'order.draft_abandoned',
  PAYMENT_SUCCEEDED:      'payment.succeeded',
  PAYMENT_FAILED:         'payment.failed',
  EMAIL_CONFIRM_PENDING:  'auth.email_confirm_pending',
  CUSTOMER_SIGNUP_COMPLETED: 'customer.signup_completed',
  ERROR_5XX:              'error.5xx',
  RATING_SUBMITTED:       'rating.submitted',
  RATING_LOW:             'rating.low',
  GPS_SPOOF_DETECTED:     'driver.gps_spoof_detected',
  DISPATCH_PHASE_CHANGED: 'dispatch.phase_changed',
  DISPATCH_NO_RESPONSE:   'dispatch.no_response',
  SMS_INBOUND:            'sms.inbound_received',
  SMS_OUTBOUND:           'sms.outbound_sent',
} as const
export type EventTypeValue = (typeof EventType)[keyof typeof EventType] | (string & {})

// ── Emit input ────────────────────────────────────────────────────────────

export interface EmitInput {
  entityType: EntityType
  entityId?:  string | null
  eventType:  EventTypeValue
  severity?:  Severity
  source:    EventSource
  payload?:   Record<string, unknown>
  actorId?:   string | null
  sessionId?: string | null
}

// ── Emit ──────────────────────────────────────────────────────────────────

/**
 * Awaitable insert. Throws on failure.
 * Use when callers genuinely need to know the event landed (rare).
 */
export async function emitEvent(input: EmitInput): Promise<{ id: string }> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('entity_events')
    .insert({
      entity_type: input.entityType,
      entity_id:   input.entityId ?? null,
      event_type:  input.eventType,
      severity:    input.severity ?? Severity.INFO,
      source:      input.source,
      payload:     input.payload ?? {},
      actor_id:    input.actorId ?? null,
      session_id:  input.sessionId ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`emitEvent failed: ${error.message}`)
  return { id: data.id as string }
}

/**
 * Fire-and-forget. Logs failure but never throws.
 * Default for every call site that isn't on a hot critical path.
 */
export function fireAndForget(input: EmitInput): void {
  emitEvent(input).catch((err) => {
    console.error('[events] fireAndForget failed', {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      message: err instanceof Error ? err.message : String(err),
    })
  })
}
