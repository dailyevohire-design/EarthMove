import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { grantId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(grantId)) {
    return NextResponse.json({ error: 'invalid_grant_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('revoke_trust_share_grant', {
    p_grant_id: grantId,
    p_revoked_by_user: user.id,
  });

  if (error) {
    return NextResponse.json({ error: 'internal', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
