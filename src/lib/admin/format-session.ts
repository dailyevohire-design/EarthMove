export type LiveSession = {
  session_id: string;
  user_id: string | null;
  role: string | null;
  first_seen_at: string;
  last_seen_at: string;
  current_path: string | null;
  referrer: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device: string | null;
  user_agent: string | null;
  ip: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  cart_value_cents: number;
  cart_item_count: number;
  cart_market_slug: string | null;
  has_signed_in: boolean;
  has_cart: boolean;
  has_groundcheck: boolean;
  page_view_count: number;
  active?: boolean;
  seconds_since_last_seen?: number;
  session_duration_seconds?: number;
};

export function flagEmoji(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function durationLabel(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
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

export function isStale(s: LiveSession, nowMs: number): boolean {
  return nowMs - new Date(s.last_seen_at).getTime() > 90_000;
}
