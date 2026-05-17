'use client';

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type PresenceRole = 'anon' | 'gc' | 'driver' | 'admin' | 'customer' | 'supplier';

// Shape mirrored into Supabase Realtime presence. Only fields the admin live grid
// + tile actually render. Anything you add here ships to every subscriber on every
// track() — keep it small.
export type PresenceState = {
  session_id: string;
  user_id: string | null;
  role: PresenceRole;
  current_path: string | null;
  device: 'mobile' | 'desktop' | 'tablet';
  city: string | null;
  region: string | null;
  country: string | null;
  cart_value_cents: number;
  cart_item_count: number;
  has_cart: boolean;
  has_groundcheck: boolean;
  has_signed_in: boolean;
  page_view_count: number;
  utm_source: string | null;
  first_seen_at: number;
};

const CHANNEL = 'presence:site';

export function joinSitePresence(
  supabase: SupabaseClient,
  initial: PresenceState
): RealtimeChannel {
  const channel = supabase.channel(CHANNEL, {
    config: { presence: { key: initial.session_id } },
  });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void channel.track(initial);
  });
  return channel;
}

// Full-state replace — callers hold the canonical PresenceState and pass it whole.
// Realtime presence track() overwrites; merging is the caller's responsibility.
export function trackPresence(channel: RealtimeChannel, state: PresenceState): void {
  void channel.track(state);
}

export function leavePresence(channel: RealtimeChannel): void {
  void channel.unsubscribe();
}

export function subscribeSitePresence(
  supabase: SupabaseClient,
  onSync: (state: Record<string, PresenceState[]>) => void
): RealtimeChannel {
  const channel = supabase.channel(CHANNEL);
  channel.on('presence', { event: 'sync' }, () => {
    onSync(channel.presenceState<PresenceState>());
  });
  channel.subscribe();
  return channel;
}
