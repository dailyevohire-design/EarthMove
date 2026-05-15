import Link from 'next/link';
export const metadata = { title: 'DPA · Trust Center' };
export default function DpaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/trust-center" className="hover:underline">Trust Center</Link> · Data Processing Agreement</p>
      <h1 className="mt-2 text-3xl font-semibold">Data Processing Agreement</h1>
      <p className="mt-3 text-stone-600">Our standard DPA aligns with GDPR Article 28 and CCPA service-provider requirements.</p>
      <section className="mt-8 rounded-lg ring-1 ring-stone-200 bg-white px-6 py-5">
        <h2 className="text-base font-medium mb-3">DPA highlights</h2>
        <ul className="text-sm space-y-2 text-stone-700 list-disc list-inside">
          <li>Customer is data controller; earthmove is data processor</li>
          <li>Confidentiality + appropriate technical &amp; organizational measures (TOMs)</li>
          <li>Subprocessor list with 30-day notice for additions; customer right to object</li>
          <li>Data subject rights assistance within 30 days (Articles 15-22)</li>
          <li>Data breach notification within 72 hours of confirmation</li>
          <li>Standard Contractual Clauses (SCC) included for non-US transfers</li>
          <li>Audit rights: annual SOC 2 report when available + on-request CAIQ Lite</li>
          <li>Data deletion / return at end of services (30 days)</li>
        </ul>
      </section>
      <section className="mt-6 rounded-lg ring-1 ring-stone-200 bg-stone-50 px-6 py-5">
        <h2 className="text-base font-medium mb-2">Execute a DPA</h2>
        <p className="text-sm text-stone-600 mb-3">For enterprise customers (Pro tier or higher), we execute a DPA at no additional cost.</p>
        <p className="text-sm"><a href="mailto:security@earthmove.io?subject=DPA%20execution%20request" className="text-emerald-700 underline">security@earthmove.io</a> · <a href="https://github.com/dailyevohire-design/EarthMove/blob/main/docs/policies/dpa-template.md" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">View template</a></p>
      </section>
    </main>
  );
}
