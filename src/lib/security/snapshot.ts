import { createPublicClient } from './server-client';

export type SecuritySnapshot = {
  open_security_cards: number; critical_24h: number;
  canary_total: number; canary_hits_24h: number;
  honeypot_hits_24h: number; unique_attackers_24h: number;
  injection_blocked_24h: number; gps_anomalies_24h: number;
  failed_auth_24h: number; active_bans: number;
  rls_findings: number; trust_reports_total: number;
  drivers_active: number; last_scan_at: string | null;
};

export async function getSecuritySnapshot(): Promise<SecuritySnapshot | null> {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb.schema('security').rpc('command_center_snapshot');
    if (error) return null;
    return data as SecuritySnapshot;
  } catch { return null; }
}

export type CanaryRow = {
  canary_id: string; canary_type: string; identifier: string;
  market_slug: string | null; placement: string; active: boolean;
  created_at: string; total_hits: number; last_hit_at: string | null;
};

export async function getCanaryOverview(): Promise<CanaryRow[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('canary_overview');
    return (data as CanaryRow[]) ?? [];
  } catch { return []; }
}

export type SecurityCard = {
  id: string; rule_key: string; severity: 'info' | 'warn' | 'critical';
  title: string; body: string | null; status: string;
  payload: Record<string, unknown>; created_at: string;
};

export async function getRecentSecurityCards(limit = 25): Promise<SecurityCard[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').rpc('recent_security_cards', { p_limit: limit });
    return (data as SecurityCard[]) ?? [];
  } catch { return []; }
}

export type AdminAction = {
  id: number; performed_at: string; actor_user_id: string;
  action: string; target_type: string; target_id: string | null;
  before_state: Record<string, unknown> | null; after_state: Record<string, unknown> | null;
  ip: string | null; user_agent: string | null; reason: string | null;
};

export async function getRecentAdminActions(limit = 100): Promise<AdminAction[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.schema('security').from('admin_actions')
      .select('*').order('performed_at', { ascending: false }).limit(limit);
    return (data as AdminAction[]) ?? [];
  } catch { return []; }
}
