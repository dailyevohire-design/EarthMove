import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CreateShareSchema = z.object({
  report_id: z.string().uuid(),
  expires_days: z.number().int().min(1).max(90).default(7),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = CreateShareSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
  }

  // Use admin client for the RPC because create_trust_share_grant uses gen_random_bytes
  // from extensions schema which is restricted to service_role
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('create_trust_share_grant', {
    p_report_id: parsed.data.report_id,
    p_granted_by_user_id: user.id,
    p_expires_days: parsed.data.expires_days,
  });

  if (error) {
    if (error.message.includes('has no access to report')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'internal', message: error.message }, { status: 500 });
  }

  const result = (Array.isArray(data) ? data[0] : data) as {
    grant_id: string;
    plaintext_token: string;
    expires_at: string;
  } | null;

  if (!result?.plaintext_token) {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  return NextResponse.json({
    grant_id: result.grant_id,
    share_url: `${origin}/share/${result.plaintext_token}`,
    expires_at: result.expires_at,
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.from('v_my_share_grants').select('*').order('granted_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: 'internal', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ grants: data ?? [] });
}
