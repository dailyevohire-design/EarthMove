import { redirect } from 'next/navigation';
import { createSecurityClient } from '@/lib/security/server-client';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getBans() {
  const sb = createSecurityClient();
  const { data } = await sb.from('v_active_bans').select('*').order('banned_at', { ascending: false }).limit(200);
  return data ?? [];
}

export default async function BansPage() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security/bans');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }
  const rows = await getBans();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Active bans</h1>
      <p className="mt-1 text-sm text-stone-500">{rows.length} IPs currently blocked at middleware layer</p>
      <table className="mt-6 w-full text-sm">
        <thead><tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
          <th className="py-2 pr-4">IP</th><th className="py-2 pr-4">Reason</th><th className="py-2 pr-4">Hits</th><th className="py-2 pr-4">Source</th><th className="py-2 pr-4">Banned</th><th className="py-2 pr-4">Expires</th>
        </tr></thead>
        <tbody>{rows.map((r: { ip: string; reason: string; hit_count: number; source: string; banned_at: string; expires_at: string }) => (
          <tr key={String(r.ip)} className="border-b border-stone-100">
            <td className="py-2 pr-4 font-mono">{String(r.ip)}</td>
            <td className="py-2 pr-4">{r.reason}</td>
            <td className="py-2 pr-4 tabular-nums">{r.hit_count}</td>
            <td className="py-2 pr-4 text-stone-500">{r.source}</td>
            <td className="py-2 pr-4 text-stone-500">{new Date(r.banned_at).toLocaleString()}</td>
            <td className="py-2 pr-4 text-stone-500">{new Date(r.expires_at).toLocaleString()}</td>
          </tr>
        ))}</tbody>
      </table>
    </main>
  );
}
