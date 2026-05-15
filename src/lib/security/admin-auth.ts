import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createPublicClient } from './server-client';

export class UnauthorizedError extends Error { constructor() { super('unauthorized'); } }
export class ForbiddenError    extends Error { constructor() { super('forbidden'); } }

export async function requireAdmin(): Promise<{ userId: string; ip: string | null; userAgent: string | null }> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* no-op in server action context */ },
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const pub = createPublicClient();
  const { data: isAdmin, error } = await pub.schema('security').rpc('fn_is_admin', { p_user_id: user.id });
  if (error || !isAdmin) throw new ForbiddenError();

  const fwd = headerStore.get('x-vercel-forwarded-for') ?? headerStore.get('x-forwarded-for') ?? headerStore.get('cf-connecting-ip');
  const ip = fwd?.split(',')[0]?.trim() ?? null;
  const userAgent = headerStore.get('user-agent');

  return { userId: user.id, ip, userAgent };
}

export async function logAdminAction(params: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    const sb = createPublicClient();
    await sb.schema('security').rpc('fn_log_admin_action', {
      p_actor_user_id: params.actorUserId,
      p_action: params.action,
      p_target_type: params.targetType,
      p_target_id: params.targetId,
      p_before_state: params.beforeState ?? null,
      p_after_state: params.afterState ?? null,
      p_ip: params.ip ?? null,
      p_user_agent: params.userAgent ?? null,
      p_reason: params.reason ?? null,
    });
  } catch { /* never fail the action over an audit write */ }
}
