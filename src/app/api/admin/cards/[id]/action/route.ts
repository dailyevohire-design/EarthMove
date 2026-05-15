import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CardAction } from '@/lib/admin/cards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function parseAction(raw: unknown): CardAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.action === 'claim') return { action: 'claim' };
  if (r.action === 'wake') return { action: 'wake' };
  if (r.action === 'snooze') {
    const d = Number(r.duration_minutes);
    if (!Number.isInteger(d) || d < 1 || d > 10080) return null;
    return { action: 'snooze', duration_minutes: d };
  }
  if (r.action === 'resolve' || r.action === 'dismiss') {
    const note = typeof r.note === 'string' ? r.note.slice(0, 500) : undefined;
    return { action: r.action, note };
  }
  return null;
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {/* server route, no refresh write */},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = parseAction(body);
  if (!action) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  if (action.action === 'claim') {
    const { data, error } = await supabase
      .from('intervention_cards')
      .update({ status: 'claimed', claimed_by: user.id, claimed_at: nowIso, updated_at: nowIso })
      .eq('id', id)
      .eq('status', 'open')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ id: data[0].id, status: 'claimed' });
  }

  if (action.action === 'snooze') {
    const snoozedUntil = new Date(Date.now() + action.duration_minutes * 60_000).toISOString();
    const { data, error } = await supabase
      .from('intervention_cards')
      .update({ status: 'snoozed', snoozed_until: snoozedUntil, updated_at: nowIso })
      .eq('id', id)
      .in('status', ['open', 'claimed'])
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ id: data[0].id, status: 'snoozed' });
  }

  if (action.action === 'resolve') {
    const { data, error } = await supabase
      .from('intervention_cards')
      .update({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: nowIso,
        resolution_note: action.note ?? null,
        updated_at: nowIso,
      })
      .eq('id', id)
      .in('status', ['open', 'claimed', 'snoozed'])
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ id: data[0].id, status: 'resolved' });
  }

  if (action.action === 'dismiss') {
    const { data, error } = await supabase
      .from('intervention_cards')
      .update({
        status: 'dismissed',
        resolved_by: user.id,
        resolved_at: nowIso,
        resolution_note: action.note ?? 'Dismissed',
        updated_at: nowIso,
      })
      .eq('id', id)
      .in('status', ['open', 'claimed', 'snoozed'])
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ id: data[0].id, status: 'dismissed' });
  }

  if (action.action === 'wake') {
    const { data, error } = await supabase
      .from('intervention_cards')
      .update({ status: 'open', snoozed_until: null, updated_at: nowIso })
      .eq('id', id)
      .eq('status', 'snoozed')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return NextResponse.json({ id: data[0].id, status: 'open' });
  }

  return NextResponse.json({ error: 'unhandled_action' }, { status: 400 });
}
