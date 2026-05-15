import { createPublicClient } from './server-client';

/**
 * WIRING into runTrustSynthesizeV2 (after score computed, before persist):
 *
 *   import { checkTrustAnomaly } from '@/lib/security/trust-anomaly';
 *   const anomalous = await checkTrustAnomaly(reportId, prevScore ?? 50, newScore, evidenceCount);
 *   if (anomalous) {
 *     await persistAsAnomalous({ reportId, newScore, evidenceCount });
 *     return;
 *   }
 *   await persistNormal({ reportId, newScore });
 */
export async function checkTrustAnomaly(reportId: string, scoreBefore: number, scoreAfter: number, evidenceCount: number): Promise<boolean> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('fn_trust_score_anomaly_check', {
      p_report_id: reportId,
      p_score_before: scoreBefore,
      p_score_after: scoreAfter,
      p_evidence_count: evidenceCount,
    });
    return Boolean(data);
  } catch { return false; }
}
