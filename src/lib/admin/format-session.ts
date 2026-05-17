import type { PresenceState } from '@/lib/realtime/presence-client';

// LiveSession is now an alias for the presence shape — admin grid renders presence
// entries directly, no more live_sessions DB rows.
export type LiveSession = PresenceState;

export function flagEmoji(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function durationLabel(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function roleBadge(role: string | null | undefined): { label: string; cls: string } {
  switch (role) {
    case 'admin':    return { label: 'admin',  cls: 'bg-violet-100 text-violet-800 ring-violet-200' };
    case 'driver':   return { label: 'driver', cls: 'bg-amber-100 text-amber-800 ring-amber-200' };
    case 'gc':       return { label: 'GC',     cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
    case 'supplier': return { label: 'supp',   cls: 'bg-sky-100 text-sky-800 ring-sky-200' };
    case 'customer': return { label: 'cust',   cls: 'bg-stone-100 text-stone-800 ring-stone-200' };
    case 'anon':
    default:         return { label: 'anon',   cls: 'bg-stone-50 text-stone-500 ring-stone-200' };
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
