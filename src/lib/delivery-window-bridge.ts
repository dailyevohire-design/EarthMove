// src/lib/delivery-window-bridge.ts
//
// Bridges legacy V1 date-range pseudo-windows (this_week, next_2_weeks,
// this_month, researching) to the V2 schema's time-of-day windows added by
// migration 233. CHECK constraints require requested_delivery_window to be
// one of '9-10am' | '1-2pm' | '4-5pm' (or null). V1 strings are date ranges,
// not times of day — they can't translate semantically.
//
// V1 payloads are normalized to delivery_type='asap' with null date/window.
// The customer's urgency intent is dropped at the DB layer; ops can recover
// it via delivery_notes or admin tooling. Acceptable bridge until the V2
// picker ships and V1 vocabulary is removed from the UI.

export const V2_WINDOWS = ['9-10am', '1-2pm', '4-5pm'] as const
export type V2Window = (typeof V2_WINDOWS)[number]

export type DeliverySchedule = {
  delivery_type: 'asap' | 'scheduled'
  requested_delivery_date: string | null // YYYY-MM-DD
  requested_delivery_window: V2Window | null
}

const V2_WINDOW_SET = new Set<string>(V2_WINDOWS)

/**
 * Normalize a delivery payload from any UI version to a DB-safe schedule.
 *
 * V2 payload (when V2 picker ships):
 *   { delivery_window: '1-2pm', delivery_date: '2026-05-15' }
 *   -> { delivery_type: 'scheduled', date: '2026-05-15', window: '1-2pm' }
 *
 * V1 payload (current UI):
 *   { delivery_window: 'this_week' | 'next_2_weeks' | 'this_month' | 'researching' }
 *   -> { delivery_type: 'asap', date: null, window: null }
 *
 * Missing / empty / unknown payload:
 *   -> { delivery_type: 'asap', date: null, window: null }
 */
export function normalizeDeliverySchedule(input: {
  delivery_window?: string | null
  delivery_date?: string | null
}): DeliverySchedule {
  const win = input.delivery_window
  if (win && V2_WINDOW_SET.has(win)) {
    return {
      delivery_type: 'scheduled',
      requested_delivery_date: input.delivery_date ?? null,
      requested_delivery_window: win as V2Window,
    }
  }
  return {
    delivery_type: 'asap',
    requested_delivery_date: null,
    requested_delivery_window: null,
  }
}
