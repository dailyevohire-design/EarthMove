'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, logAdminAction, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';
import {
  claimSecurityCard, resolveSecurityCard, snoozeSecurityCard, dismissSecurityCard,
} from '@/lib/security/cards';
import { SECURITY } from '@/lib/security/constants';

function clampNote(note: string): string {
  return (note ?? '').slice(0, SECURITY.RESOLUTION_NOTE_MAX_CHARS);
}

export async function claimCardAction(cardId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const before = await claimSecurityCard(cardId, userId);
    await logAdminAction({
      actorUserId: userId, action: 'claim', targetType: 'intervention_card', targetId: cardId,
      beforeState: before, afterState: { status: 'claimed', claimed_by: userId },
      ip, userAgent,
    });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError)    return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'error' };
  }
}

export async function resolveCardAction(cardId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const clamped = clampNote(note);
    const before = await resolveSecurityCard(cardId, userId, clamped || 'Resolved');
    await logAdminAction({
      actorUserId: userId, action: 'resolve', targetType: 'intervention_card', targetId: cardId,
      beforeState: before, afterState: { status: 'resolved', resolution_note: clamped },
      ip, userAgent, reason: clamped,
    });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError)    return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'error' };
  }
}

export async function snoozeCardAction(cardId: string, minutes: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const clampedMin = Math.max(5, Math.min(minutes, 1440));
    const before = await snoozeSecurityCard(cardId, clampedMin);
    await logAdminAction({
      actorUserId: userId, action: 'snooze', targetType: 'intervention_card', targetId: cardId,
      beforeState: before, afterState: { status: 'snoozed', minutes: clampedMin },
      ip, userAgent,
    });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError)    return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'error' };
  }
}

export async function dismissCardAction(cardId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, ip, userAgent } = await requireAdmin();
    const clamped = clampNote(note);
    const before = await dismissSecurityCard(cardId, userId, clamped || 'Dismissed');
    await logAdminAction({
      actorUserId: userId, action: 'dismiss', targetType: 'intervention_card', targetId: cardId,
      beforeState: before, afterState: { status: 'dismissed', resolution_note: clamped },
      ip, userAgent, reason: clamped,
    });
    revalidatePath('/admin/security');
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (e instanceof ForbiddenError)    return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'error' };
  }
}
