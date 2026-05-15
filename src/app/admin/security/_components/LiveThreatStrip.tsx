'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import type { SecuritySnapshot } from '@/lib/security/snapshot';

type Props = { initial: SecuritySnapshot | null };

export function LiveThreatStrip({ initial }: Props) {
  const [snap, setSnap] = useState<SecuritySnapshot | null>(initial);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const ch = sb
      .channel('security_intervention_cards')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intervention_cards' }, async () => {
        try {
          const res = await fetch('/api/security/health', { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json.snapshot) setSnap(json.snapshot);
          }
        } catch {}
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  if (!snap) return null;

  const isHot = snap.critical_24h > 0 || snap.canary_hits_24h > 0;
  const ringClass = isHot ? 'ring-red-300 bg-red-50' : snap.open_security_cards > 0 ? 'ring-amber-300 bg-amber-50' : 'ring-emerald-200 bg-emerald-50';

  return (
    <div className={`mb-6 rounded-xl ring-1 ${ringClass} px-4 py-3 transition ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${isHot ? 'bg-red-500' : snap.open_security_cards > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          <span className="text-sm font-medium">
            {isHot ? 'Active threats — review now' : snap.open_security_cards > 0 ? `${snap.open_security_cards} open security cards` : 'All clear · last 24h'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs tabular-nums text-stone-700">
          <Stat label="canary hits" value={snap.canary_hits_24h} tone={snap.canary_hits_24h > 0 ? 'red' : 'stone'} />
          <Stat label="honeypot" value={snap.honeypot_hits_24h} tone={snap.honeypot_hits_24h > 0 ? 'amber' : 'stone'} />
          <Stat label="injection blocked" value={snap.injection_blocked_24h} tone={snap.injection_blocked_24h > 0 ? 'amber' : 'stone'} />
          <Stat label="gps anomaly" value={snap.gps_anomalies_24h} tone={snap.gps_anomalies_24h > 0 ? 'amber' : 'stone'} />
          <Stat label="failed auth" value={snap.failed_auth_24h} tone={snap.failed_auth_24h > 0 ? 'amber' : 'stone'} />
          <Stat label="active bans" value={snap.active_bans} tone="stone" />
        </div>
        <Link href="/admin/security" className="text-xs font-medium underline">Open dashboard →</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'stone' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-stone-500';
  return (
    <span className="flex items-baseline gap-1">
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-stone-500">{label}</span>
    </span>
  );
}
