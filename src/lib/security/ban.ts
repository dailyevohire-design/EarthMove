import { createPublicClient } from './server-client';

// In-memory ban list: load every active ban once on cold start, refresh in the
// background every 5 minutes, do O(1) Set lookups on every request. The previous
// per-IP RPC pattern hit Supabase on first request per IP and returned 406 every
// time because the security schema is not in API.exposed_schemas. Migration 276
// adds public.fn_active_bans / public.fn_ban_ip wrappers so the reads succeed
// from the public schema, and this cache cuts request count from ~one-per-page to
// ~one-per-refresh-window per Vercel isolate.

type BanCache = {
  bans: Set<string>;
  loadedAt: number;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let cache: BanCache | null = null;
let inflight: Promise<BanCache | null> | null = null;

async function loadBans(): Promise<BanCache | null> {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb.rpc('fn_active_bans');
    if (error) return null;
    const rows = (data ?? []) as Array<{ ip: string }>;
    return { bans: new Set(rows.map((r) => r.ip)), loadedAt: Date.now() };
  } catch {
    return null;
  }
}

function refreshInBackground(): void {
  if (inflight) return;
  inflight = loadBans()
    .then((next) => {
      if (next) cache = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });
}

export async function isBanned(ip: string): Promise<boolean> {
  if (!ip) return false;
  if (!cache) {
    if (!inflight) {
      inflight = loadBans()
        .then((c) => {
          if (c) cache = c;
          return c;
        })
        .finally(() => {
          inflight = null;
        });
    }
    await inflight;
    if (!cache) return false;
  } else if (Date.now() - cache.loadedAt > REFRESH_INTERVAL_MS) {
    refreshInBackground();
  }
  return cache?.bans.has(ip) ?? false;
}

export async function banIp(ip: string, reason: string, minutes: number, source = 'auto'): Promise<void> {
  if (!ip) return;
  try {
    const sb = createPublicClient();
    await sb.rpc('fn_ban_ip', { p_ip: ip, p_reason: reason, p_minutes: minutes, p_source: source });
    if (cache) cache.bans.add(ip);
  } catch { /* best-effort */ }
}
