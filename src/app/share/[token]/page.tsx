import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import TrustReportView from '@/components/trust/TrustReportView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedReportPage({ params }: PageProps) {
  const { token } = await params;

  if (!/^[A-Za-z0-9]{32}$/.test(token)) {
    return <UnavailableShare />;
  }

  const admin = createAdminClient();
  const { data: report, error } = await admin.rpc('consume_trust_share_grant', {
    p_plaintext_token: token,
  });

  if (error || !report) {
    return <UnavailableShare />;
  }

  const reportRow = Array.isArray(report) ? report[0] : report;

  if (!reportRow) {
    return <UnavailableShare />;
  }

  return (
    <main>
      <div className="border-b border-stone-200 bg-stone-50 px-6 py-3 text-center text-sm text-stone-600">
        You&apos;re viewing a Groundcheck report shared with you. Run your own at{' '}
        <Link href="/trust" className="underline">earthmove.io/trust</Link>.
      </div>
      <TrustReportView report={reportRow} />
    </main>
  );
}

function UnavailableShare() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-medium tracking-tight" style={{ color: '#0E2A22' }}>
        This shared report is unavailable
      </h1>
      <p className="mt-4 text-stone-600">
        This share link has expired, been revoked, or doesn&apos;t exist. Run a fresh
        Groundcheck report at{' '}
        <Link href="/trust" className="underline">earthmove.io/trust</Link>.
      </p>
    </main>
  );
}
