'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { telemetry, type SessionInitResponse } from '@/lib/telemetry';
import type { PresenceState } from '@/lib/realtime/presence-client';
import { telemetryCart } from '@/lib/telemetry-cart';

// Any path matching this regex marks the session as having touched a Groundcheck
// surface, which flips presence.has_groundcheck=true and re-tracks immediately.
const GROUNDCHECK_PATH_RE =
  /^\/(trust|groundcheck|share|dashboard\/(trust|gc\/trust|driver\/trust|contractor\/trust|driver\/groundcheck))/i;

function readUtmSource(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('utm_source');
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Boot once on mount: fetch session_id + role + geo from /api/session/init,
  // then seed presence. Init is idempotent and bot-gated server-side.
  useEffect(() => {
    let cancelled = false;
    telemetry.boot();

    (async () => {
      let init: SessionInitResponse | null = null;
      try {
        const res = await fetch('/api/session/init', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (res.status === 204) return; // bot — skip presence
        if (!res.ok) return;
        init = (await res.json()) as SessionInitResponse;
      } catch {
        return;
      }
      if (cancelled || !init) return;

      const cart = telemetryCart.get();
      const seed: PresenceState = {
        session_id: init.session_id,
        user_id: init.user_id,
        role: init.role,
        current_path: typeof window !== 'undefined' ? window.location.pathname : null,
        device: init.device,
        city: init.city,
        region: init.region,
        country: init.country,
        cart_value_cents: cart?.value_cents ?? 0,
        cart_item_count: cart?.item_count ?? 0,
        has_cart: Boolean(cart && (cart.value_cents > 0 || cart.item_count > 0)),
        has_groundcheck: false,
        has_signed_in: init.user_id !== null,
        // Server-owned, cookie-persistent counters. Never overwrite from the
        // client; subsequent navs bump page_view_count optimistically via
        // telemetry.onRouteChange and POST /api/session/pageview reconciles.
        page_view_count: init.page_view_count,
        utm_source: readUtmSource(),
        first_seen_at: init.first_seen_at,
      };
      telemetry.startPresence(seed);
    })();

    return () => {
      cancelled = true;
      telemetry.stopPresence();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route changes: flag groundcheck if matched, then emit page.view (+ page.exit
  // for the prior path if there was one). Also fires on the initial render,
  // which is the single source of the first page.view emission.
  useEffect(() => {
    if (!pathname) return;
    if (GROUNDCHECK_PATH_RE.test(pathname)) {
      telemetry.markGroundcheck();
    }
    telemetry.onRouteChange(pathname);
  }, [pathname]);

  return <>{children}</>;
}
