import { redirect } from 'next/navigation';
import { getCanaryOverview } from '@/lib/security/snapshot';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CanariesPage() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security/canaries');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }
  const canaries = await getCanaryOverview();
  const totalHits = canaries.reduce((acc, c) => acc + Number(c.total_hits ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Canary network</h1>
      <p className="mt-1 text-sm text-stone-500">
        Trip wires planted across supplier listings and trust-subject corpora.
        Any external contact with these identifiers is a confirmed exfiltration signal.
      </p>

      <div className="mt-4 flex gap-3 text-sm">
        <span className="rounded bg-stone-100 px-2 py-1">total: {canaries.length}</span>
        <span className={`rounded px-2 py-1 ${totalHits > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
          hits all-time: {totalHits}
        </span>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead><tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
          <th className="py-2 pr-4">Type</th>
          <th className="py-2 pr-4">Identifier</th>
          <th className="py-2 pr-4">Market</th>
          <th className="py-2 pr-4">Placement</th>
          <th className="py-2 pr-4">Hits</th>
          <th className="py-2 pr-4">Last hit</th>
        </tr></thead>
        <tbody>{canaries.map((c) => (
          <tr key={c.canary_id} className="border-b border-stone-100">
            <td className="py-2 pr-4 font-mono text-xs">{c.canary_type}</td>
            <td className="py-2 pr-4 font-mono">{c.identifier}</td>
            <td className="py-2 pr-4 text-stone-500">{c.market_slug ?? '—'}</td>
            <td className="py-2 pr-4 font-mono text-xs text-stone-500">{c.placement}</td>
            <td className={`py-2 pr-4 tabular-nums ${Number(c.total_hits) > 0 ? 'text-red-700 font-semibold' : 'text-stone-500'}`}>{c.total_hits}</td>
            <td className="py-2 pr-4 text-stone-500">{c.last_hit_at ? new Date(c.last_hit_at).toLocaleString() : '—'}</td>
          </tr>
        ))}</tbody>
      </table>

      <div className="mt-8 rounded-lg ring-1 ring-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
        <strong>Operator notes:</strong> Supplier canaries use 555-01xx test-block numbers as placeholders.
        Provision real Twilio numbers, then update each <code className="font-mono">security.canary_listings.identifier</code> and
        the matching <code className="font-mono">supplier_offerings.supplier_description</code>.
        Twilio webhook URL: <code className="font-mono">https://earthmove.io/api/security/canary/twilio</code> (HMAC-verified).
        SendGrid Parse URL: <code className="font-mono">https://earthmove.io/api/security/canary/email/$CANARY_EMAIL_SECRET</code>.
      </div>
    </main>
  );
}
