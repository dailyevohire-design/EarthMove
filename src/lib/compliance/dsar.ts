import { createComplianceClient, createPublicClient } from './server-client';
import { randomBytes } from 'crypto';

export async function createDsarRequest(input: { requestType: 'access'|'portability'|'rectification'|'restriction'|'objection'; subjectEmail: string; subjectPhone?: string; ip?: string | null; userAgent?: string | null }) {
  const sb = createComplianceClient();
  const { data, error } = await sb.from('dsar_requests').insert({
    request_type: input.requestType, subject_email: input.subjectEmail.toLowerCase().trim(),
    subject_phone: input.subjectPhone, ip_at_submission: input.ip, user_agent_at_submission: input.userAgent,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'dsar_create_failed');
  return { id: data.id as string };
}

export async function createErasureRequest(input: { subjectEmail: string; reason?: string; mode?: 'soft_anonymize' | 'hard_delete' }) {
  const sb = createComplianceClient();
  const { data, error } = await sb.from('erasure_requests').insert({
    subject_email: input.subjectEmail.toLowerCase().trim(), reason: input.reason, mode: input.mode ?? 'soft_anonymize',
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'erasure_create_failed');
  return { id: data.id as string };
}

export async function fulfillDsar(requestId: string, subjectUserId: string, fulfilledByUserId: string) {
  const pub = createPublicClient();
  const { data: exportData, error: exportError } = await pub.schema('compliance').rpc('export_user_data', { p_user_id: subjectUserId });
  if (exportError) throw new Error('export_failed: ' + exportError.message);
  const exportToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
  const sb = createComplianceClient();
  await sb.from('dsar_requests').update({
    status: 'completed', fulfilled_at: new Date().toISOString(), fulfilled_by_user_id: fulfilledByUserId,
    export_token: exportToken, export_expires_at: expiresAt,
    notes: JSON.stringify({ exportPayload: exportData, expiresAt }),
  }).eq('id', requestId);
  return { exportToken, expiresAt };
}

export async function fulfillErasure(requestId: string, subjectUserId: string, mode: 'soft_anonymize' | 'hard_delete') {
  const pub = createPublicClient();
  const { data, error } = await pub.schema('compliance').rpc('erase_user_data', { p_user_id: subjectUserId, p_request_id: requestId, p_mode: mode });
  if (error) throw new Error('erase_failed: ' + error.message);
  return data;
}
