import { createPublicClient } from './server-client';
import { createHash } from 'crypto';

export async function recordConsent(params: {
  userId?: string | null; subjectEmail?: string;
  scope: 'tos' | 'privacy' | 'marketing' | 'analytics' | 'ai_training' | 'sms' | 'cookie';
  granted: boolean; policyText?: string; policyVersionLabel?: string;
  ip?: string | null; userAgent?: string | null; evidence?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const hash = createHash('sha256').update(params.policyText ?? params.policyVersionLabel ?? params.scope).digest('hex');
    const sb = createPublicClient();
    const { data, error } = await sb.schema('compliance').rpc('record_consent', {
      p_user_id: params.userId ?? null, p_subject_email: params.subjectEmail ?? null,
      p_scope: params.scope, p_granted: params.granted,
      p_policy_version_hash: hash, p_policy_version_label: params.policyVersionLabel ?? null,
      p_ip: params.ip ?? null, p_user_agent: params.userAgent ?? null, p_evidence: params.evidence ?? {},
    });
    return error ? null : (data as string);
  } catch { return null; }
}
