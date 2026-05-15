import { redirect } from 'next/navigation';
import { createSecurityClient } from '@/lib/security/server-client';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getRls() {
  const sb = createSecurityClient();
  const { data } = await sb.from('v_rls_status').select('*').order('severity').order('table_name');
  return data ?? [];
}

export default async function RlsPage() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security/rls');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }
  const rows = await getRls();
  const bySeverity = rows.reduce<Record<string, number>>((acc, r: { severity: string }) => {
    acc[r.severity] = (acc[r.severity] ?? 0) + 1;
    return acc;
  }, {});
  const findings = rows.filter((r: { severity: string }) => r.severity !== 'OK');

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">RLS status</h1>
      <p className="mt-1 text-sm text-stone-500">Nightly scan · 03:00 UTC · self-healing via security.fn_lockdown_unprotected()</p>
      <div className="mt-4 flex gap-3 text-sm">
        {['CRITICAL', 'HIGH', 'INFO', 'OK'].map((sev) => (
          <span key={sev} className={`rounded px-2 py-1 ${sev === 'CRITICAL' ? 'bg-red-100 text-red-800' : sev === 'HIGH' ? 'bg-amber-100 text-amber-800' : sev === 'INFO' ? 'bg-stone-100 text-stone-700' : 'bg-emerald-100 text-emerald-800'}`}>
            {sev}: {bySeverity[sev] ?? 0}
          </span>
        ))}
      </div>
      {findings.length === 0 ? (
        <p className="mt-6 rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-800">All {rows.length} tables passing.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="py-2 pr-4">Table</th><th className="py-2 pr-4">Severity</th><th className="py-2 pr-4">RLS</th><th className="py-2 pr-4">Policies</th><th className="py-2 pr-4">Sensitive cols</th>
          </tr></thead>
          <tbody>{findings.map((r: { table_name: string; severity: string; rls_enabled: boolean; policy_count: number; sensitive_columns: string[] | null }) => (
            <tr key={r.table_name} className="border-b border-stone-100">
              <td className="py-2 pr-4 font-mono">{r.table_name}</td>
              <td className="py-2 pr-4">{r.severity}</td>
              <td className="py-2 pr-4">{r.rls_enabled ? 'on' : 'OFF'}</td>
              <td className="py-2 pr-4">{r.policy_count}</td>
              <td className="py-2 pr-4 text-stone-500">{r.sensitive_columns?.join(', ') ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </main>
  );
}
