/**
 * Resend-backed email dispatcher for trust_alert_dispatches.
 *
 * Reads a pending dispatch row, looks up the user's email from auth.users,
 * renders the appropriate template, sends via Resend, marks the row sent
 * (or failed). Returns the new dispatch_status so the worker can decide
 * whether to retry.
 *
 * RESEND_API_KEY env var required. If missing, dispatcher returns 'failed'
 * with reason='resend_not_configured' and the worker should suppress
 * further retries via dispatch_status='failed'.
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  renderFindingTypeAlert,
  renderScoreDropAlert,
  type FindingTypeAlertPayload,
  type ScoreDropAlertPayload,
  type RenderedAlert,
} from './templates';

export type EmailDispatchStatus = 'sent' | 'failed' | 'suppressed';

export interface EmailDispatchResult {
  status: EmailDispatchStatus;
  reason?: string;
  resend_message_id?: string;
}

interface DispatchRow {
  id: string;
  subscription_id: string;
  trigger_type: 'finding_type' | 'score_drop' | 'manual';
  payload: FindingTypeAlertPayload | ScoreDropAlertPayload | Record<string, unknown>;
  channel: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS
  ?? 'Groundcheck <alerts@earthmove.io>';

export async function dispatchAlertEmail(dispatchId: string): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await markDispatch(dispatchId, 'failed', 'resend_not_configured');
    return { status: 'failed', reason: 'resend_not_configured' };
  }

  const admin = createAdminClient();

  const { data: dispatch, error: dErr } = await admin
    .from('trust_alert_dispatches')
    .select('id, subscription_id, trigger_type, payload, channel')
    .eq('id', dispatchId)
    .single();
  if (dErr || !dispatch) {
    return { status: 'failed', reason: `dispatch_lookup: ${dErr?.message ?? 'no row'}` };
  }
  const d = dispatch as DispatchRow;

  if (d.channel !== 'email') {
    return { status: 'suppressed', reason: 'channel_mismatch' };
  }

  const { data: sub, error: sErr } = await admin
    .from('trust_watch_subscriptions')
    .select('id, user_id')
    .eq('id', d.subscription_id)
    .single();
  if (sErr || !sub) {
    await markDispatch(dispatchId, 'failed', `subscription_lookup: ${sErr?.message ?? 'no row'}`);
    return { status: 'failed', reason: 'subscription_lookup' };
  }
  const s = sub as SubscriptionRow;

  const { data: userInfo, error: uErr } = await admin.auth.admin.getUserById(s.user_id);
  if (uErr || !userInfo?.user?.email) {
    await markDispatch(dispatchId, 'failed', `user_email_lookup: ${uErr?.message ?? 'no email'}`);
    return { status: 'failed', reason: 'user_email_lookup' };
  }
  const toEmail = userInfo.user.email;

  let rendered: RenderedAlert;
  if (d.trigger_type === 'finding_type') {
    rendered = renderFindingTypeAlert(d.payload as FindingTypeAlertPayload);
  } else if (d.trigger_type === 'score_drop') {
    rendered = renderScoreDropAlert(d.payload as ScoreDropAlertPayload);
  } else {
    await markDispatch(dispatchId, 'failed', `unknown_trigger_type: ${d.trigger_type}`);
    return { status: 'failed', reason: 'unknown_trigger_type' };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [toEmail],
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    const reason = `resend_http_${resp.status}: ${errBody.slice(0, 200)}`;
    await markDispatch(dispatchId, 'failed', reason);
    return { status: 'failed', reason };
  }

  const okBody = await resp.json().catch(() => ({} as Record<string, unknown>));
  const messageId = (okBody as { id?: string }).id ?? null;
  await markDispatch(dispatchId, 'sent', null);
  return { status: 'sent', resend_message_id: messageId ?? undefined };
}

async function markDispatch(
  id: string,
  status: 'sent' | 'failed',
  reason: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const update: Record<string, unknown> = { dispatch_status: status };
  if (status === 'sent') update.sent_at = new Date().toISOString();
  if (status === 'failed') {
    update.failed_at = new Date().toISOString();
    update.failure_reason = reason ?? null;
  }
  await admin.from('trust_alert_dispatches').update(update).eq('id', id);
}
