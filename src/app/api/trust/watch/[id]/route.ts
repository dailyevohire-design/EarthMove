/**
 * /api/trust/watch/[id]
 *
 * PATCH { active?, channels?, notify_on_finding_types?, notify_on_score_drop_threshold? }
 *   — update subscription fields. RLS enforces ownership.
 *
 * DELETE — remove the subscription row. RLS enforces ownership.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const ALLOWED_PATCH_FIELDS = new Set([
  'active',
  'channels',
  'notify_on_finding_types',
  'notify_on_score_drop_threshold',
]);

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (ALLOWED_PATCH_FIELDS.has(k)) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no allowed fields in body' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('trust_watch_subscriptions')
    .update(update)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ subscription: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('trust_watch_subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
