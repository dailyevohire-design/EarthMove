import { createPublicClient } from './server-client';

// In-memory ban list: load every active ban once on cold start, refresh in the
// background every 5 minutes, do O(1) Set lookups on every request.
//
// Why we call public.fn_active_bans / public.fn_ban_ip and not security.* directly:
// the security schema is intentionally absent from API.exposed_schemas so its 30+
// tables and functions (banned_ips, honeypot_hits, ai_injection_attempts, etc.) are
// not discoverable via the PostgREST OpenAPI surface. The two public wrappers
// (migration 276) are the deliberate, minimal interface the app is allowed to use;
// adding more security-schema callers means adding more wrappers, not exposing the
// schema. See migration 276 header for the historical 406 incident that motivated
// the wrappers.

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
