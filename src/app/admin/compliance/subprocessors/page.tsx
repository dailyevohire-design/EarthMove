import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';
import { createComplianceClient } from '@/lib/compliance/server-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TABLE_MAP: Record<string, string> = {
  'dsar':'dsar_requests','erasure':'erasure_requests','subprocessors':'subprocessors',
  'incidents':'incidents','access-reviews':'access_reviews','policies':'policies',
  'drills':'restore_drills','threat-model':'threat_model_items',
};

export default async function Page() {
  try { await requireAdmin(); }
  catch (e) { if (e instanceof UnauthorizedError) redirect('/login?next=/admin/compliance/subprocessors'); if (e instanceof ForbiddenError) redirect('/'); throw e; }
  const sb = createComplianceClient();
  const table = TABLE_MAP['subprocessors'];
  const { data } = await sb.from(table).select('*').limit(200);
  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/admin/compliance" className="hover:underline">Compliance</Link> · subprocessors</p>
      <h1 className="mt-2 text-2xl font-semibold">{('subprocessors').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</h1>
      <p className="mt-1 text-sm text-stone-500">{rows.length} rows · table <code className="font-mono text-xs">compliance.{table}</code></p>
      <div className="mt-6 rounded-lg ring-1 ring-stone-200 bg-white overflow-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-stone-50">
            {rows[0] && (<tr className="border-b border-stone-200 text-left">{Object.keys(rows[0]).slice(0, 12).map((k) => (<th key={k} className="py-2 px-3 uppercase tracking-wide text-stone-500 font-medium">{k}</th>))}</tr>)}
          </thead>
          <tbody>{rows.map((r: Record<string, unknown>, i: number) => (
            <tr key={i} className="border-b border-stone-100 align-top">
              {Object.keys(r).slice(0, 12).map((k) => (
                <td key={k} className="py-2 px-3 font-mono whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">{typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k] ?? '')}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </main>
  );
}
