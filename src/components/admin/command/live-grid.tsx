'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { LiveSessionTile } from './live-session-tile';
import { subscribeSitePresence, type PresenceState } from '@/lib/realtime/presence-client';
import { type LiveSession, formatCents } from '@/lib/admin/format-session';

const TICK_MS = 5000;

export function LiveGrid() {
  const [sessions, setSessions] = useState<Map<string, LiveSession>>(new Map());
  // `now` is read by tile label helpers (timeAgo/durationLabel via Date.now() at call time);
  // we still need a periodic re-render so labels tick. The map itself is presence-driven.
  const [, setNow] = useState(Date.now());
  // First-paint grace: true once the channel has emitted at least one sync.
  // Until then, render "Waiting for first sync…" instead of the empty state.
  const [hasSynced, setHasSynced] = useState(false);
  // Becomes true 250ms after mount so we don't flash "Waiting…" on snappy syncs.
  const [showGrace, setShowGrace] = useState(false);

  // Re-render tick — labels update without re-fetching. No stale sweep needed:
  // presence sync is authoritative for "who's here right now."
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // 250ms grace timer for the empty-state copy.
  useEffect(() => {
    const t = setTimeout(() => setShowGrace(true), 250);
    return () => clearTimeout(t);
  }, []);

  // Subscribe to the site presence channel. Every sync replaces the visible set.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const channel = subscribeSitePresence(supabase, (state) => {
      const next = new Map<string, LiveSession>();
      for (const key of Object.keys(state)) {
        // Each presence key holds an array of meta entries; one tab per session
        // in normal usage, so we take the first.
        const meta = state[key]?.[0] as PresenceState | undefined;
        if (meta && meta.session_id) next.set(meta.session_id, meta);
      }
      setSessions(next);
      setHasSynced(true);
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const list = useMemo(() => {
    const arr = Array.from(sessions.values());
    arr.sort((a, b) => {
      if (a.cart_value_cents !== b.cart_value_cents) return b.cart_value_cents - a.cart_value_cents;
      if (a.has_signed_in !== b.has_signed_in) return a.has_signed_in ? -1 : 1;
      return b.first_seen_at - a.first_seen_at;
    });
    return arr;
  }, [sessions]);

  const stats = useMemo(() => {
    const byRole = new Map<string, number>();
    const byCity = new Map<string, number>();
    let cartTotal = 0;
    for (const s of list) {
      const r = s.role ?? 'anon';
      byRole.set(r, (byRole.get(r) ?? 0) + 1);
      if (s.city) byCity.set(s.city, (byCity.get(s.city) ?? 0) + 1);
      cartTotal += s.cart_value_cents;
    }
    return {
      total: list.length,
      byRole: Array.from(byRole.entries()).sort((a, b) => b[1] - a[1]),
      topCities: Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      cartTotalCents: cartTotal,
    };
  }, [list]);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Live now" value={stats.total.toString()} accent="emerald" />
        <Stat label="Cart on table" value={formatCents(stats.cartTotalCents)} accent="amber" />
        <Stat
          label="By role"
          value={stats.byRole.map(([r, n]) => `${r}:${n}`).join(' · ') || '—'}
        />
        <Stat
          label="Top cities"
          value={stats.topCities.map(([c, n]) => `${c} ${n}`).join(' · ') || '—'}
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 p-12 text-center text-stone-500">
          {!hasSynced && showGrace ? (
            <>
              <p className="text-sm">Waiting for first sync…</p>
              <p className="text-xs mt-1 text-stone-400">Subscribing to the Supabase Realtime presence channel.</p>
            </>
          ) : (
            <>
              <p className="text-sm">No one is on the site right now.</p>
              <p className="text-xs mt-1 text-stone-400">Tiles arrive in real time via Supabase Realtime presence.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((s) => (
            <LiveSessionTile key={s.session_id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'amber';
}) {
  const accentCls =
    accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : 'text-stone-900';
  return (
    <div className="rounded-lg bg-white border border-stone-200 p-3">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`mt-1 text-lg font-medium truncate ${accentCls}`}>{value}</div>
    </div>
  );
}
