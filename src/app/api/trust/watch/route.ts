/**
 * /api/trust/watch
 *
 * GET  ?contractor_id=<uuid>   — return the current user's subscription for
 *                                that contractor (or null)
 * POST { contractor_id }       — subscribe (create row, defaults active=true,
 *                                channels=[email], default notify_on_finding_types)
 *
 * RLS gates ownership; we use the user's session, not the admin client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contractorId = url.searchParams.get('contractor_id');
  if (!contractorId) {
    return NextResponse.json({ error: 'contractor_id required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ subscription: null });
  }

  const { data, error } = await supabase
    .from('trust_watch_subscriptions')
    .select('id, contractor_id, active, channels, notify_on_finding_types, notify_on_score_drop_threshold, created_at, last_alerted_at')
    .eq('contractor_id', contractorId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ subscription: data ?? null });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { contractor_id?: string };
  const contractorId = body.contractor_id;
  if (!contractorId) {
    return NextResponse.json({ error: 'contractor_id required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Insert (or restore active=true if soft-disabled). RLS WITH CHECK enforces
  // user_id = auth.uid() so we don't need to defend against impersonation.
  const { data, error } = await supabase
    .from('trust_watch_subscriptions')
    .upsert(
      {
        user_id: userData.user.id,
        contractor_id: contractorId,
        active: true,
      },
      { onConflict: 'user_id,contractor_id' },
    )
    .select('id, contractor_id, active, channels, notify_on_finding_types, notify_on_score_drop_threshold, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ subscription: data });
}
