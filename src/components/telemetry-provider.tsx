'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { telemetry } from '@/lib/telemetry';
import { telemetryCart, telemetryGroundcheck } from '@/lib/telemetry-cart';

// Any path matching this regex marks the session as having touched a Groundcheck
// surface, which sets live_sessions.has_groundcheck=true on the next heartbeat.
const GROUNDCHECK_PATH_RE =
  /^\/(trust|groundcheck|share|dashboard\/(trust|gc\/trust|driver\/trust|contractor\/trust|driver\/groundcheck))/i;

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Boot once on mount. Getters resolve at heartbeat time, not at boot time —
  // they read live state from the module-level mirrors so any imperative
  // setCart() / setGroundcheck() call is reflected on the next heartbeat.
  useEffect(() => {
    telemetry.boot({
      cartGetter: () => {
        const c = telemetryCart.get();
        return c
          ? { value_cents: c.value_cents, item_count: c.item_count, market_slug: c.market_slug }
          : null;
      },
      groundcheckGetter: () => telemetryGroundcheck.get(),
    });
    // NOTE: do NOT emit page.view here. The pathname effect below handles
    // initial render — emitting in both would double-fire on every first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route changes: flag groundcheck if matched, then emit page.view (+ page.exit
  // for the prior path if there was one). Also fires on the initial render,
  // which is the single source of the first page.view emission.
  useEffect(() => {
    if (!pathname) return;
    if (GROUNDCHECK_PATH_RE.test(pathname)) {
      telemetryGroundcheck.set(true);
    }
    telemetry.onRouteChange(pathname);
  }, [pathname]);

  return <>{children}</>;
}
