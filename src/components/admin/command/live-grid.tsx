'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { LiveSessionTile } from './live-session-tile';
import { type LiveSession, isStale, formatCents } from '@/lib/admin/format-session';

const TICK_MS = 5000;

export function LiveGrid({ initialSessions }: { initialSessions: LiveSession[] }) {
  const [sessions, setSessions] = useState<Map<string, LiveSession>>(() => {
    const m = new Map<string, LiveSession>();
    for (const s of initialSessions) m.set(s.session_id, s);
    return m;
  });
  const [now, setNow] = useState(Date.now());

  // Tick: re-render labels + sweep stale tiles (no extra fetches)
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setSessions((prev) => {
        const cutoff = Date.now() - 90_000;
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (new Date(v.last_seen_at).getTime() < cutoff) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('admin_live_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<LiveSession>;
            if (!old.session_id) return;
            setSessions((prev) => {
              if (!prev.has(old.session_id!)) return prev;
              const next = new Map(prev);
              next.delete(old.session_id!);
              return next;
            });
            return;
          }
          const row = payload.new as LiveSession;
          if (!row?.session_id) return;
          setSessions((prev) => {
            const next = new Map(prev);
            next.set(row.session_id, row);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const list = useMemo(() => {
    const arr = Array.from(sessions.values()).filter((s) => !isStale(s, now));
    arr.sort((a, b) => {
      if (a.cart_value_cents !== b.cart_value_cents) return b.cart_value_cents - a.cart_value_cents;
      if (a.has_signed_in !== b.has_signed_in) return a.has_signed_in ? -1 : 1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });
    return arr;
  }, [sessions, now]);

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
          <p className="text-sm">No one is on the site right now.</p>
          <p className="text-xs mt-1 text-stone-400">Tiles arrive in real time via Supabase.</p>
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
