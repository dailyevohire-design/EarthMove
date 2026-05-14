'use client';

import type { TelemetryEvent, TelemetryEventType } from './telemetry-types';

const FLUSH_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;
const IDLE_THRESHOLD_MS = 60000;
const MAX_QUEUE = 50;

type TelemetryContext = {
  pathGetter?: () => string;
  cartGetter?: () => { value_cents: number; item_count: number; market_slug?: string } | null;
  groundcheckGetter?: () => boolean;
};

class TelemetryClient {
  private queue: TelemetryEvent[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pageEnterTs = 0;
  private currentPath = '';
  private ctx: TelemetryContext = {};
  private booted = false;

  boot(ctx: TelemetryContext = {}) {
    if (typeof window === 'undefined' || this.booted) return;
    this.booted = true;
    this.ctx = ctx;
    this.pageEnterTs = Date.now();
    this.currentPath = window.location.pathname;

    // Initial heartbeat (sets cookie)
    this.heartbeat();

    // Periodic heartbeat while tab is visible — singleton; no cleanup needed
    setInterval(() => {
      if (document.visibilityState === 'visible') this.heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Periodic flush
    setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Fire on tab close — sendBeacon survives unload
    window.addEventListener('pagehide', () => this.flushBeacon(true));
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushBeacon(false);
      else this.resetIdle();
    });

    // Idle detection
    ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach((evt) =>
      window.addEventListener(evt, () => this.resetIdle(), { passive: true })
    );
    this.resetIdle();
  }

  // Public emit
  emit(type: TelemetryEventType, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    this.queue.push({ type, ts: Date.now(), payload });
    if (this.queue.length >= MAX_QUEUE) this.flush();
  }

  // Public route-change handler — fires page.exit for prev path + page.view for new
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
    this.heartbeat();
  }

  private resetIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.emit('page.idle', { path: this.currentPath, idle_ms: IDLE_THRESHOLD_MS });
    }, IDLE_THRESHOLD_MS);
  }

  private maxScrollDepth(): number {
    if (typeof window === 'undefined') return 0;
    const h = document.documentElement;
    return Math.min(100, Math.round(((h.scrollTop + h.clientHeight) / h.scrollHeight) * 100));
  }

  private heartbeat() {
    const utm = this.readUtm();
    const cart = this.ctx.cartGetter?.() ?? null;
    const body = {
      path: this.currentPath,
      referrer: document.referrer || null,
      utm,
      cart: cart ?? undefined,
      has_groundcheck: Boolean(this.ctx.groundcheckGetter?.()),
    };
    fetch('/api/telemetry/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {/* swallow */});
  }

  private readUtm() {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      source: sp.get('utm_source') ?? undefined,
      medium: sp.get('utm_medium') ?? undefined,
      campaign: sp.get('utm_campaign') ?? undefined,
      term: sp.get('utm_term') ?? undefined,
      content: sp.get('utm_content') ?? undefined,
    };
  }

  private flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ events: batch }),
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
    const blob = new Blob([JSON.stringify({ events: this.queue })], { type: 'application/json' });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/telemetry', blob);
    } else {
      this.flush();
    }
    this.queue = [];
  }
}

export const telemetry = new TelemetryClient();
