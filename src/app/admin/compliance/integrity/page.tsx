import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';
import { verifyAdminChain } from '@/lib/compliance/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegrityPage() {
  try { await requireAdmin(); }
  catch (e) { if (e instanceof UnauthorizedError) redirect('/login?next=/admin/compliance/integrity'); if (e instanceof ForbiddenError) redirect('/'); throw e; }
  const chain = await verifyAdminChain();
  const ok = chain && chain.first_break_id === null && chain.total_rows === chain.verified;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/admin/compliance" className="hover:underline">Compliance</Link> · Audit chain integrity</p>
      <h1 className="mt-2 text-2xl font-semibold">Audit chain integrity</h1>
      <p className="mt-2 text-sm text-stone-600">Every admin action since system inception is hashed into a Merkle chain. Modifying any row in <code className="font-mono text-xs">security.admin_actions</code> breaks every subsequent hash. This page recomputes the chain on demand.</p>

      <div className={`mt-6 rounded-xl ring-1 px-6 py-5 ${ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-300'}`}>
        <div className="flex items-center gap-3">
          <span className={`inline-block h-3 w-3 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-base font-medium">{ok ? 'Chain intact · tamper-evident' : 'CHAIN BROKEN · investigate immediately'}</span>
        </div>
        {chain && (<dl className="mt-4 text-sm space-y-1 text-stone-700">
          <div className="flex justify-between"><dt>Total rows</dt><dd className="font-mono">{chain.total_rows}</dd></div>
          <div className="flex justify-between"><dt>Verified</dt><dd className="font-mono">{chain.verified}</dd></div>
          <div className="flex justify-between"><dt>First break id</dt><dd className="font-mono">{chain.first_break_id ?? 'none'}</dd></div>
          <div className="flex justify-between"><dt>Latest root hash</dt><dd className="font-mono text-xs break-all">{chain.latest_root_hash ?? '—'}</dd></div>
        </dl>)}
      </div>

      <p className="mt-6 text-xs text-stone-500">For an external audit, share this page or call <code className="font-mono">SELECT * FROM security.fn_verify_admin_chain();</code> via Supabase MCP. The latest root hash can be published daily to a third-party timestamp service (e.g., OpenTimestamps) for trustless proof.</p>
    </main>
  );
}
