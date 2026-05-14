'use client';

// Module-level mirrors that the command center telemetry layer reads on every heartbeat.
//
// Why this exists:
//   - The buyer flow does NOT have a shared cart context (per recon 2026-05-14).
//   - The contractor wizard at src/app/dashboard/contractor/orders/new/_wizard/
//     has its own internal state.
//   - Either surface can call telemetryCart.set(...) imperatively from add/remove
//     handlers. <TelemetryProvider> reads via getter on each 30s heartbeat, which
//     upserts live_sessions.cart_value_cents / .has_cart — the signal that drives
//     the amber high-value border on /admin/command/live.
//
// This is intentionally NOT a React context. No re-render side effects; pure
// imperative mirror of the user's current cart-ish state.

export type TelemetryCartState = {
  value_cents: number;
  item_count: number;
  market_slug?: string;
};

type Listener = (state: TelemetryCartState | null) => void;

let currentCart: TelemetryCartState | null = null;
const cartListeners = new Set<Listener>();

export const telemetryCart = {
  get(): TelemetryCartState | null {
    return currentCart;
  },
  set(state: TelemetryCartState | null): void {
    currentCart = state;
    for (const l of cartListeners) {
      try {
        l(state);
      } catch {
        /* one bad listener should not kill the rest */
      }
    }
  },
  clear(): void {
    telemetryCart.set(null);
  },
  subscribe(fn: Listener): () => void {
    cartListeners.add(fn);
    return () => {
      cartListeners.delete(fn);
    };
  },
};

// Path-derived "this session has touched a Groundcheck surface" flag.
// Set by <TelemetryProvider> when pathname matches GROUNDCHECK_PATH_RE.
// Stays true for the lifetime of the page session — there's no untouch event.
let groundcheckTouched = false;

export const telemetryGroundcheck = {
  get(): boolean {
    return groundcheckTouched;
  },
  set(v: boolean): void {
    groundcheckTouched = v;
  },
};
