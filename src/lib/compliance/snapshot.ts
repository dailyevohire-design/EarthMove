import { createPublicClient } from './server-client';

export type ComplianceSnapshot = Record<string, Record<string, number | string | null>> & { as_of: string };
export type PublicSubprocessor = { vendor_name: string; vendor_url: string | null; purpose: string; data_categories: string[]; data_residency: string; compliance_certs: string[]; dpa_in_place: boolean; risk_tier: string };

export async function getComplianceSnapshot(): Promise<ComplianceSnapshot | null> {
  try { const sb = createPublicClient(); const { data, error } = await sb.schema('compliance').rpc('compliance_snapshot'); return error ? null : (data as ComplianceSnapshot); }
  catch { return null; }
}
export async function getPublicSubprocessors(): Promise<PublicSubprocessor[]> {
  try { const sb = createPublicClient(); const { data } = await sb.schema('compliance').rpc('public_subprocessors'); return (data as PublicSubprocessor[]) ?? []; }
  catch { return []; }
}
export async function verifyAdminChain(): Promise<{ total_rows: number; verified: number; first_break_id: number | null; latest_root_hash: string | null } | null> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('fn_verify_admin_chain');
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  } catch { return null; }
}
