'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin, logAdminAction, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';
import { fulfillDsar, fulfillErasure } from '@/lib/compliance/dsar';
import { createComplianceClient } from '@/lib/compliance/server-client';

export async function fulfillDsarAction(requestId: string, subjectUserId: string): Promise<{ ok: boolean; error?: string; exportToken?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const r = await fulfillDsar(requestId, subjectUserId, userId);
    await logAdminAction({ actorUserId: userId, action: 'dsar_fulfill', targetType: 'dsar_request', targetId: requestId, ip, userAgent, reason: 'export ready' });
    revalidatePath('/admin/compliance/dsar');
    return { ok: true, exportToken: r.exportToken };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}

export async function fulfillErasureAction(requestId: string, subjectUserId: string, mode: 'soft_anonymize' | 'hard_delete'): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    await fulfillErasure(requestId, subjectUserId, mode);
    await logAdminAction({ actorUserId: userId, action: 'erasure_fulfill', targetType: 'erasure_request', targetId: requestId, ip, userAgent, reason: `mode=${mode}` });
    revalidatePath('/admin/compliance/erasure');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}

export async function executeRestoreDrillAction(drillId: string, actualMinutes: number, dataIntegrityVerified: boolean, notes: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const sb = createComplianceClient();
    await sb.from('restore_drills').update({
      executed_at: new Date().toISOString(), executed_by_user_id: userId,
      actual_recovery_time_minutes: actualMinutes, data_integrity_verified: dataIntegrityVerified,
      status: dataIntegrityVerified ? 'passed' : 'failed', notes: notes.slice(0, 1000),
    }).eq('id', drillId);
    await logAdminAction({ actorUserId: userId, action: 'restore_drill_executed', targetType: 'restore_drill', targetId: drillId, ip, userAgent, reason: notes.slice(0, 200) });
    revalidatePath('/admin/compliance/drills');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}
