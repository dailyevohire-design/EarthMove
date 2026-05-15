import { redirect } from 'next/navigation';
import { getRecentAdminActions } from '@/lib/security/snapshot';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAuditPage() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security/audit');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }
  const actions = await getRecentAdminActions(200);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin actions audit</h1>
      <p className="mt-1 text-sm text-stone-500">
        Append-only at the database layer. Every claim, resolve, snooze, dismiss on a security card lands here.
        A compromised admin account cannot quietly clear evidence — the trace survives.
      </p>

      <table className="mt-6 w-full text-xs">
        <thead><tr className="border-b border-stone-200 text-left uppercase tracking-wide text-stone-500">
          <th className="py-2 pr-4">When</th>
          <th className="py-2 pr-4">Actor</th>
          <th className="py-2 pr-4">Action</th>
          <th className="py-2 pr-4">Target</th>
          <th className="py-2 pr-4">IP</th>
          <th className="py-2 pr-4">Reason</th>
        </tr></thead>
        <tbody>{actions.map((a) => (
          <tr key={a.id} className="border-b border-stone-100 align-top">
            <td className="py-2 pr-4 text-stone-500 whitespace-nowrap">{new Date(a.performed_at).toLocaleString()}</td>
            <td className="py-2 pr-4 font-mono">{a.actor_user_id.slice(0, 8)}</td>
            <td className="py-2 pr-4 font-mono">{a.action}</td>
            <td className="py-2 pr-4 font-mono text-stone-500">{a.target_type}:{a.target_id?.slice(0, 8)}</td>
            <td className="py-2 pr-4 font-mono text-stone-500">{a.ip ?? '—'}</td>
            <td className="py-2 pr-4 text-stone-600 max-w-xs truncate">{a.reason ?? '—'}</td>
          </tr>
        ))}</tbody>
      </table>

      {actions.length === 0 && <p className="mt-6 text-sm text-stone-500">No admin actions logged yet.</p>}
    </main>
  );
}
