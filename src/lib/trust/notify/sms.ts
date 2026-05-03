/**
 * SMS dispatcher — STUB ONLY (Chunk 2 wires Twilio + PEWC consent gating).
 *
 * Production-ready SMS dispatch requires:
 *   1. Twilio credentials (account SID + auth token)
 *   2. PEWC (prior express written consent) verification against
 *      sms_consent table — the user must have opted in to SMS for the
 *      specific phone number on file
 *   3. TCR brand registration completion (already done for earthmove.io)
 *   4. Carrier-aware rate limiting + retry semantics
 *
 * This stub marks any SMS dispatch row as 'suppressed' with a clear
 * reason so the worker doesn't retry. The dispatch row remains in the
 * trust_alert_dispatches audit trail for visibility.
 */

import { createAdminClient } from '@/lib/supabase/server';

export type SmsDispatchStatus = 'sent' | 'failed' | 'suppressed';

export interface SmsDispatchResult {
  status: SmsDispatchStatus;
  reason: string;
}

export async function dispatchAlertSms(dispatchId: string): Promise<SmsDispatchResult> {
  const reason = 'sms_deferred_chunk2_pewc_gating_not_yet_wired';
  const admin = createAdminClient();
  await admin
    .from('trust_alert_dispatches')
    .update({
      dispatch_status: 'suppressed',
      failure_reason: reason,
      failed_at: new Date().toISOString(),
    })
    .eq('id', dispatchId);
  return { status: 'suppressed', reason };
}
