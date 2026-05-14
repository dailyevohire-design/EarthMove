// Client-side event registry for the command center.
//
// CROSS-REFERENCE: this file is the CLIENT emit whitelist. The SERVER-side
// emit registry lives in src/lib/events.ts (EventType enum). The two do not
// overlap and serve different purposes:
//
//   - src/lib/events.ts: server-emitted events (Stripe webhook, Inngest,
//     internal RPCs). Includes ORDER_PLACED, ORDER_FIRST_TIME, etc.
//   - This file: client-emitted events fired from the browser via the
//     /api/telemetry batch ingest. Browser-only signals like page.view,
//     cart.material_added, groundcheck.search.
//
// Both write to the same `entity_events` table; downstream funnel queries
// can join them by session_id or actor_id.
//
// Whitelist is enforced server-side in /api/telemetry/route.ts — anything
// not in TELEMETRY_EVENT_TYPES is dropped before it ever reaches the table.

export const TELEMETRY_EVENT_TYPES = [
  'page.view',
  'page.idle',
  'page.exit',
  'form.field_focus',
  'form.field_blur_empty',
  'cart.material_added',
  'cart.material_removed',
  'cart.viewed',
  'checkout.step_entered',
  'checkout.step_exited_without_advance',
  'groundcheck.search',
  'groundcheck.report_viewed',
  'groundcheck.upgrade_clicked',
  'groundcheck.upgrade_abandoned',
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];
export const TELEMETRY_EVENT_TYPE_SET = new Set<string>(TELEMETRY_EVENT_TYPES);

export type TelemetryEvent = {
  type: TelemetryEventType;
  ts?: number;
  payload?: Record<string, unknown>;
};

// Map client event type → entity_events.entity_type. Defaults to 'session'.
export function eventTypeToEntityType(
  type: TelemetryEventType,
  hasOrderId: boolean
): 'session' | 'order' | 'customer' {
  if (type.startsWith('checkout.') && hasOrderId) return 'order';
  if (type.startsWith('groundcheck.')) return 'customer';
  return 'session';
}

// Severity map: page.view/idle are debug-level (high volume); rest is info.
export function eventTypeToSeverity(type: TelemetryEventType): 'debug' | 'info' {
  if (type === 'page.view' || type === 'page.idle') return 'debug';
  return 'info';
}
