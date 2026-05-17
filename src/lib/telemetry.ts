'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TelemetryEvent, TelemetryEventType } from './telemetry-types';
import {
  joinSitePresence,
  trackPresence,
  leavePresence,
  type PresenceState,
} from './realtime/presence-client';
import { telemetryCart, telemetryGroundcheck } from './telemetry-cart';
import type { SessionInitResponse } from '@/app/api/session/init/route';

const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 50;

class TelemetryClient {
  private queue: TelemetryEvent[] = [];
  private pageEnterTs = 0;
  private currentPath = '';
  private booted = false;

  // Presence state held module-side so trackPresence() can replay the full shape.
  private presence: PresenceState | null = null;
  private channel: RealtimeChannel | null = null;
  private cartUnsubscribe: (() => void) | null = null;

  boot() {
    if (typeof window === 'undefined' || this.booted) return;
    this.booted = true;
    this.pageEnterTs = Date.now();
    this.currentPath = window.location.pathname;

    setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    window.addEventListener('pagehide', () => {
      this.flushBeacon(true);
      this.stopPresence();
    });
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushBeacon(false);
        this.stopPresence();
      } else if (this.presence) {
        this.startPresence(this.presence);
      }
    });
  }

  // Public: kick off Realtime presence. Called by TelemetryProvider after
  // /api/session/init returns. Safe to call again after a stop (visibility flip).
  startPresence(seed: PresenceState) {
    if (typeof window === 'undefined') return;
    if (this.channel) return; // already joined

    this.presence = seed;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    this.channel = joinSitePresence(supabase, seed);

    // Mirror cart changes into presence — every set() on telemetryCart re-tracks.
    this.cartUnsubscribe = telemetryCart.subscribe((state) => {
      const value = state?.value_cents ?? 0;
      const count = state?.item_count ?? 0;
      this.updatePresence({
        cart_value_cents: value,
        cart_item_count: count,
        has_cart: value > 0 || count > 0,
      });
    });
  }

  // Public: merge a patch into the held PresenceState and track() it.
  updatePresence(patch: Partial<PresenceState>) {
    if (!this.presence || !this.channel) return;
    this.presence = { ...this.presence, ...patch };
    trackPresence(this.channel, this.presence);
  }

  // Public: drop out of the channel (tab hidden, pagehide). Keeps `presence`
  // around so a visibility flip can re-join with the same state.
  stopPresence() {
    if (this.channel) {
      leavePresence(this.channel);
      this.channel = null;
    }
    if (this.cartUnsubscribe) {
      this.cartUnsubscribe();
      this.cartUnsubscribe = null;
    }
  }

  // Public emit
  emit(type: TelemetryEventType, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    this.queue.push({ type, ts: Date.now(), payload });
    if (this.queue.length >= MAX_QUEUE) this.flush();
  }

  // Public route-change handler — fires page.exit for prev path + page.view for new.
  // Also bumps presence.current_path + page_view_count.
  onRouteChange(newPath: string) {
    if (!this.booted) return;
    if (this.currentPath && newPath !== this.currentPath) {
      this.emit('page.exit', {
        path: this.currentPath,
        duration_ms: Date.now() - this.pageEnterTs,
        scroll_depth: this.maxScrollDepth(),
      });
    }
    this.currentPath = newPath;
    this.pageEnterTs = Date.now();
    this.emit('page.view', { path: newPath, referrer: document.referrer });
    if (this.presence) {
      // Optimistic local bump so the admin tile reflects the nav instantly.
      // The durable counter lives in the __es_sid cookie; fire-and-forget POST
      // hands the increment to the server (server owns the count for sampling).
      this.updatePresence({
        current_path: newPath,
        page_view_count: this.presence.page_view_count + 1,
      });
      fetch('/api/session/pageview', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => {/* swallow; next init will reconcile */});
    }
  }

  // Public: provider calls this when groundcheck path is matched. Sets module
  // mirror and re-tracks presence so the admin tile flips immediately.
  markGroundcheck() {
    telemetryGroundcheck.set(true);
    this.updatePresence({ has_groundcheck: true });
  }

  // Public: build the engagement payload for /api/telemetry sampling. Replaces
  // the server-side live_sessions lookup that used to drive engagement.
  engagementSnapshot(): { has_cart: boolean; has_groundcheck: boolean; has_signed_in: boolean } {
    return {
      has_cart: this.presence?.has_cart ?? false,
      has_groundcheck: this.presence?.has_groundcheck ?? false,
      has_signed_in: this.presence?.has_signed_in ?? false,
    };
  }

  private maxScrollDepth(): number {
    if (typeof window === 'undefined') return 0;
    const h = document.documentElement;
    return Math.min(100, Math.round(((h.scrollTop + h.clientHeight) / h.scrollHeight) * 100));
  }

  private flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ events: batch, engagement: this.engagementSnapshot() }),
      keepalive: true,
    }).catch(() => {/* swallow; events lost is acceptable */});
  }

  private flushBeacon(emitExit: boolean) {
    if (emitExit) {
      this.queue.push({
        type: 'page.exit',
        ts: Date.now(),
        payload: {
          path: this.currentPath,
          duration_ms: Date.now() - this.pageEnterTs,
          scroll_depth: this.maxScrollDepth(),
        },
      });
    }
    if (this.queue.length === 0) return;
    const blob = new Blob(
      [JSON.stringify({ events: this.queue, engagement: this.engagementSnapshot() })],
      { type: 'application/json' }
    );
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/telemetry', blob);
    } else {
      this.flush();
    }
    this.queue = [];
  }
}

export const telemetry = new TelemetryClient();
export type { SessionInitResponse };
