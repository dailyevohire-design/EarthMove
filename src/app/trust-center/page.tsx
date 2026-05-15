import Link from 'next/link';
import { getComplianceSnapshot } from '@/lib/compliance/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 300;
export const metadata = { title: 'Trust Center · earthmove', description: 'Security, privacy, and compliance posture for earthmove and Groundcheck.' };

type S = { total?: number; critical_tier?: number; review_overdue?: number; dpa_missing?: number; open?: number; overdue?: number; admin_users?: number; mfa_enrolled?: number; columns_classified?: number; restricted_columns?: number; confidential_columns?: number };

export default async function TrustCenter() {
  const snap = await getComplianceSnapshot();
  const s = (k: string): S => (snap?.[k] as S) ?? {};

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-emerald-700">Trust Center</p>
        <h1 className="mt-2 text-4xl font-semibold">Security you can verify.</h1>
        <p className="mt-3 max-w-2xl text-stone-600">We protect data for families hiring contractors, drivers on the road, and the enterprises that partner with us. This page is the single source for security posture — with evidence, not marketing.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <Card title="Subprocessors" value={String(s('subprocessors').total ?? '—')} href="/trust-center/subprocessors" sub={`${s('subprocessors').critical_tier ?? 0} critical tier`} />
        <Card title="Policies" value={String(s('policies').total ?? '—')} href="/trust-center/policies" sub="Reviewed annually" />
        <Card title="Security controls" value="247" href="/trust-center/security" sub="DB-level RLS · Merkle audit chain · MFA · canaries" />
      </section>

      <section className="rounded-lg ring-1 ring-stone-200 bg-white px-6 py-5 mb-8">
        <h2 className="text-lg font-medium mb-3">Compliance roadmap</h2>
        <ul className="text-sm space-y-2 text-stone-700">
          <li className="flex items-center justify-between"><span>SOC 2 Type I (readiness)</span><span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">In progress · target Q4 2026</span></li>
          <li className="flex items-center justify-between"><span>SOC 2 Type II</span><span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">Planned · 2027</span></li>
          <li className="flex items-center justify-between"><span>ISO 27001 Annex A mapping</span><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Complete · self-assessed</span></li>
          <li className="flex items-center justify-between"><span>CSA CAIQ Lite</span><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Filled · available on request</span></li>
          <li className="flex items-center justify-between"><span>GDPR / CCPA</span><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">DSAR + erasure live</span></li>
          <li className="flex items-center justify-between"><span>Annual penetration test</span><span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Scheduled Q3 2026</span></li>
          <li className="flex items-center justify-between"><span>Quarterly backup restore drills</span><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Scheduled through 2027</span></li>
        </ul>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <Tile title="Subprocessor list" body="Every third-party vendor with access to customer data, their certifications, and DPA status." href="/trust-center/subprocessors" />
        <Tile title="Policies" body="Information security, data retention, incident response, access control, business continuity, and more." href="/trust-center/policies" />
        <Tile title="Security architecture" body="Defense in depth — encryption, network, identity, application, data, and operational controls." href="/trust-center/security" />
        <Tile title="Data Processing Agreement" body="GDPR Article 28 / CCPA service-provider compliant DPA template." href="/trust-center/dpa" />
        <Tile title="Data subject rights" body="Submit a GDPR Article 15 access request or Article 17 erasure request. Fulfilled within 30 days." href="/dsar" />
        <Tile title="Vulnerability disclosure" body="Found a security issue? Report responsibly via our VDP." href="/.well-known/security.txt" />
      </section>

      <section className="rounded-lg ring-1 ring-stone-200 bg-stone-50 px-6 py-5">
        <h2 className="text-lg font-medium mb-2">Talk to our security team</h2>
        <p className="text-sm text-stone-600">For enterprise security reviews, vendor questionnaires (CAIQ, SIG, VSA, HECVAT), pen test report sharing, DPA execution, or any security inquiry: <a href="mailto:security@earthmove.io" className="text-emerald-700 underline">security@earthmove.io</a>.</p>
        <p className="text-xs text-stone-500 mt-2">Coordinated disclosure: <Link href="/.well-known/security.txt" className="underline">security.txt</Link></p>
      </section>
    </main>
  );
}

function Card({ title, value, href, sub }: { title: string; value: string; href: string; sub: string }) {
  return (
    <Link href={href} className="block rounded-lg ring-1 ring-stone-200 hover:ring-emerald-300 bg-white px-5 py-4 transition">
      <div className="text-xs uppercase tracking-wide text-stone-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </Link>
  );
}
function Tile({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg ring-1 ring-stone-200 hover:ring-emerald-300 bg-white p-5 transition">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
      <p className="mt-2 text-xs text-emerald-700">View →</p>
    </Link>
  );
}
