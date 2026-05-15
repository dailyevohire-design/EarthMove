import Link from 'next/link';
import { getPublicSubprocessors } from '@/lib/compliance/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 300;
export const metadata = { title: 'Subprocessors · Trust Center' };

export default async function SubprocessorsPage() {
  const rows = await getPublicSubprocessors();
  const byTier = (t: string) => rows.filter(r => r.risk_tier === t);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/trust-center" className="hover:underline">Trust Center</Link> · Subprocessors</p>
      <h1 className="mt-2 text-3xl font-semibold">Subprocessors</h1>
      <p className="mt-2 max-w-2xl text-stone-600">Third-party vendors that process customer data on our behalf. We assess every subprocessor annually and require a Data Processing Agreement aligned with GDPR Article 28 before granting access.</p>
      <p className="mt-2 text-xs text-stone-500">Last updated {new Date().toISOString().slice(0,10)} · {rows.length} active subprocessors</p>
      {['critical','high','medium','low'].map((tier) => {
        const tr = byTier(tier); if (tr.length===0) return null;
        return (
          <section key={tier} className="mt-8">
            <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">{tier} tier · {tr.length}</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4">Vendor</th><th className="py-2 pr-4">Purpose</th><th className="py-2 pr-4">Data categories</th><th className="py-2 pr-4">Residency</th><th className="py-2 pr-4">Certifications</th><th className="py-2 pr-4">DPA</th>
              </tr></thead>
              <tbody>{tr.map((r) => (
                <tr key={r.vendor_name} className="border-b border-stone-100 align-top">
                  <td className="py-2 pr-4 font-medium">{r.vendor_url ? <a href={r.vendor_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.vendor_name}</a> : r.vendor_name}</td>
                  <td className="py-2 pr-4 text-stone-600">{r.purpose}</td>
                  <td className="py-2 pr-4 text-stone-500 text-xs">{r.data_categories.join(', ')}</td>
                  <td className="py-2 pr-4 text-stone-500 text-xs">{r.data_residency}</td>
                  <td className="py-2 pr-4 text-stone-500 text-xs">{r.compliance_certs.join(' · ')}</td>
                  <td className="py-2 pr-4 text-xs">{r.dpa_in_place ? <span className="text-emerald-700">✓ in place</span> : <span className="text-amber-700">in negotiation</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        );
      })}
      <section className="mt-10 rounded-lg ring-1 ring-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-600">
        <strong>Notification of changes:</strong> We notify customers in writing at least 30 days before adding a new subprocessor that processes customer data. Customers may object within 14 days of notification.
      </section>
    </main>
  );
}
