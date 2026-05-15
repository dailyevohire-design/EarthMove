import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getComplianceSnapshot } from '@/lib/compliance/snapshot';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComplianceCenter() {
  try { await requireAdmin(); }
  catch (e) { if (e instanceof UnauthorizedError) redirect('/login?next=/admin/compliance'); if (e instanceof ForbiddenError) redirect('/'); throw e; }
  const snap = await getComplianceSnapshot();
  const get = (k: string) => (snap?.[k] as Record<string, number | string | null>) ?? {};

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Compliance command center</h1>
          <p className="mt-1 text-sm text-stone-500">Single pane of glass for enterprise vendor reviews, SOC 2 readiness, and audit evidence.</p>
        </div>
        <nav className="flex gap-3 text-sm flex-wrap">
          <Link href="/admin/compliance/dsar" className="text-stone-600 hover:underline">DSAR</Link>
          <Link href="/admin/compliance/erasure" className="text-stone-600 hover:underline">Erasure</Link>
          <Link href="/admin/compliance/subprocessors" className="text-stone-600 hover:underline">Subprocessors</Link>
          <Link href="/admin/compliance/incidents" className="text-stone-600 hover:underline">Incidents</Link>
          <Link href="/admin/compliance/access-reviews" className="text-stone-600 hover:underline">Access reviews</Link>
          <Link href="/admin/compliance/policies" className="text-stone-600 hover:underline">Policies</Link>
          <Link href="/admin/compliance/drills" className="text-stone-600 hover:underline">Restore drills</Link>
          <Link href="/admin/compliance/threat-model" className="text-stone-600 hover:underline">Threat model</Link>
          <Link href="/admin/compliance/training" className="text-stone-600 hover:underline">Training</Link>
          <Link href="/admin/compliance/integrity" className="text-stone-600 hover:underline">Audit integrity</Link>
        </nav>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Box title="DSAR open" value={String(get('dsar').open ?? 0)} sub={`${get('dsar').overdue ?? 0} overdue`} hot={Number(get('dsar').overdue) > 0} />
        <Box title="Erasure open" value={String(get('erasure').open ?? 0)} sub={`${get('erasure').overdue ?? 0} overdue`} hot={Number(get('erasure').overdue) > 0} />
        <Box title="Incidents open" value={String(get('incidents').open ?? 0)} sub={`${get('incidents').sev1_or_2_open ?? 0} SEV1/2`} hot={Number(get('incidents').sev1_or_2_open) > 0} />
        <Box title="Subprocessors" value={String(get('subprocessors').total ?? 0)} sub={`${get('subprocessors').dpa_missing ?? 0} missing DPA`} hot={Number(get('subprocessors').dpa_missing) > 0} />
        <Box title="Admin users w/o MFA" value={String(get('identity').admin_users_without_mfa ?? 0)} sub={`${get('identity').admin_users ?? 0} admins total`} hot={Number(get('identity').admin_users_without_mfa) > 0} />
        <Box title="Policies" value={String(get('policies').total ?? 0)} sub={`${get('policies').review_overdue ?? 0} overdue`} hot={Number(get('policies').review_overdue) > 0} />
        <Box title="Access review" value={String(get('access_reviews').next_due ?? '—')} sub={`${get('access_reviews').overdue ?? 0} overdue`} hot={Number(get('access_reviews').overdue) > 0} />
        <Box title="Key rotation" value={String(get('encryption_keys').total ?? 0)} sub={`${get('encryption_keys').rotation_overdue ?? 0} overdue`} hot={Number(get('encryption_keys').rotation_overdue) > 0} />
      </div>

      <section className="mt-8 rounded-lg ring-1 ring-stone-200 bg-stone-50 px-5 py-4 text-sm">
        <h2 className="font-medium mb-1">Audit evidence export</h2>
        <p className="text-stone-600">SIEM-ready JSON export of admin actions + incidents: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">GET /api/admin/audit/export?since=ISO&amp;until=ISO</code></p>
      </section>
    </main>
  );
}

function Box({ title, value, sub, hot }: { title: string; value: string; sub: string; hot: boolean }) {
  return (
    <div className={`rounded-lg ring-1 px-4 py-3 ${hot ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-stone-200'}`}>
      <div className="text-xs uppercase tracking-wide text-stone-500">{title}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${hot ? 'text-amber-800' : ''}`}>{value}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </div>
  );
}
