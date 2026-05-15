import Link from 'next/link';
import { createPublicClient } from '@/lib/compliance/server-client';

export const dynamic = 'force-dynamic';
export const revalidate = 600;
export const metadata = { title: 'Policies · Trust Center' };

type Policy = { policy_key: string; title: string; framework_alignment: string[]; doc_path: string; current_version: string; effective_date: string; next_review_due: string };

async function getPolicies(): Promise<Policy[]> {
  const sb = createPublicClient();
  const { data } = await sb.schema('compliance').from('policies').select('*').eq('is_public', true).order('title');
  return (data as Policy[]) ?? [];
}
const GH = (path: string) => `https://github.com/dailyevohire-design/EarthMove/blob/main/${path}`;

export default async function PoliciesPage() {
  const rows = await getPolicies();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/trust-center" className="hover:underline">Trust Center</Link> · Policies</p>
      <h1 className="mt-2 text-3xl font-semibold">Policies</h1>
      <p className="mt-2 max-w-2xl text-stone-600">Each policy is versioned, owned, and reviewed annually. Framework alignment shows which SOC 2, ISO 27001, NIST CSF, GDPR, or CCPA criteria the policy supports.</p>
      <div className="mt-8 space-y-3">
        {rows.map((p) => (
          <div key={p.policy_key} className="rounded-lg ring-1 ring-stone-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-medium">{p.title}</h2>
              <div className="text-xs text-stone-500 tabular-nums">v{p.current_version} · effective {p.effective_date} · next review {p.next_review_due}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{p.framework_alignment.map((f) => (<span key={f} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{f}</span>))}</div>
            <a href={GH(p.doc_path)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-emerald-700 hover:underline">Read policy on GitHub →</a>
          </div>
        ))}
      </div>
    </main>
  );
}
