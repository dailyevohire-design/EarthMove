import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyChain, type EvidenceChainNode } from '@/lib/trust/chain-verify';
import EntityConfirmationBanner from '@/components/trust/EntityConfirmationBanner';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: Promise<{ reportId: string }>;
}

interface VerifyData {
  report: {
    id: string;
    contractor_name: string;
    state_code: string;
    city: string | null;
    trust_score: number | null;
    risk_level: string | null;
    created_at: string;
    job_id: string | null;
    data_sources_searched: string[] | null;
    // 227/D2 — drives EntityConfirmationBanner rendering on the share page.
    searched_as: string | null;
    data_integrity_status: string | null;
    raw_report: Record<string, unknown> | null;
  };
  verified: boolean;
  evidence_count: number;
  mismatch_count: number;
  hasChain: boolean;
}

async function loadVerification(reportId: string): Promise<VerifyData | null> {
  if (!/^[0-9a-f-]{36}$/.test(reportId)) return null;

  const admin = createAdminClient();
  const { data: report } = await admin
    .from('trust_reports')
    .select(
      'id, job_id, contractor_name, state_code, city, trust_score, risk_level, created_at, data_sources_searched, searched_as, data_integrity_status, raw_report',
    )
    .eq('id', reportId)
    .maybeSingle();

  if (!report) return null;

  const hasChain = !!report.job_id;
  if (!hasChain) {
    return {
      report,
      verified: false,
      evidence_count: 0,
      mismatch_count: 0,
      hasChain: false,
    };
  }

  const { data: evidence } = await admin
    .from('trust_evidence')
    .select('id, job_id, sequence_number, finding_type, response_sha256, prev_hash, chain_hash')
    .eq('job_id', report.job_id)
    .order('sequence_number', { ascending: true });

  const result = verifyChain((evidence ?? []) as EvidenceChainNode[]);
  return {
    report,
    verified: result.verified,
    evidence_count: result.evidence_count,
    mismatch_count: result.mismatches.length,
    hasChain: true,
  };
}

export default async function TrustVerifyPage({ params }: VerifyPageProps) {
  const { reportId } = await params;
  const data = await loadVerification(reportId);
  if (!data) notFound();

  const { report, verified, evidence_count, hasChain } = data;
  const reportDate = new Date(report.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const sources = report.data_sources_searched ?? [];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
            <span>Groundcheck</span>
            <span className="text-stone-300">·</span>
            <span>Chain verification</span>
          </div>
        </header>

        {/* D2: confirmation banner. Surfaces the matched entity above the
            chain-verification block. Self-handles non-render states. */}
        <div className="mb-4">
          <EntityConfirmationBanner report={report} />
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
          {!hasChain ? (
            <NoChainBlock />
          ) : verified ? (
            <VerifiedBlock evidenceCount={evidence_count} />
          ) : (
            <MismatchBlock evidenceCount={evidence_count} />
          )}

          <dl className="mt-6 pt-6 border-t border-stone-200 space-y-3 text-sm">
            <Field label="Contractor" value={report.contractor_name} />
            <Field
              label="Location"
              value={[report.city, report.state_code].filter(Boolean).join(', ') || report.state_code}
            />
            <Field
              label="Trust score"
              value={
                report.trust_score != null
                  ? `${report.trust_score} / 100${report.risk_level ? ` · ${report.risk_level}` : ''}`
                  : '—'
              }
            />
            <Field label="Report date" value={reportDate} />
            {hasChain && <Field label="Evidence rows" value={String(evidence_count)} />}
          </dl>

          {sources.length > 0 && (
            <div className="mt-6 pt-6 border-t border-stone-200">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                Sources searched
              </div>
              <ul className="text-xs text-stone-700 space-y-1">
                {sources.slice(0, 12).map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="text-stone-300">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-stone-200">
            <Link
              href={`/dashboard/trust/report/${report.id}`}
              className="block w-full text-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm py-3 transition-colors"
            >
              View full report
            </Link>
            <p className="mt-2 text-[11px] text-stone-500 text-center">
              Sign-in required to view the full report.
            </p>
          </div>
        </section>

        <footer className="mt-8 text-center text-[11px] text-stone-500">
          <p>
            Powered by{' '}
            <Link href="/trust" className="font-semibold text-emerald-700 hover:underline">
              Groundcheck
            </Link>
          </p>
          <p className="mt-1">Earth Pro Connect LLC · earthmove.io/trust</p>
        </footer>
      </div>
    </div>
  );
}

function VerifiedBlock({ evidenceCount }: { evidenceCount: number }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 mb-4">
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-emerald-800">Verified</h1>
      <p className="mt-2 text-sm text-stone-600 leading-relaxed">
        All {evidenceCount} evidence rows match their stored chain hashes.
        This report has not been tampered with since it was first generated.
      </p>
    </div>
  );
}

function MismatchBlock({ evidenceCount }: { evidenceCount: number }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-4 border-red-200 mb-4">
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-red-700" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-red-800">Verification failed</h1>
      <p className="mt-2 text-sm text-stone-600 leading-relaxed">
        One or more of the {evidenceCount} evidence rows does not match its stored
        chain hash. The report may have been altered. Please contact support.
      </p>
    </div>
  );
}

function NoChainBlock() {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-stone-100 border-4 border-stone-200 mb-4">
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-stone-700">Chain verification unavailable</h1>
      <p className="mt-2 text-sm text-stone-600 leading-relaxed">
        This report was generated on a free-tier search and does not include
        a verifiable evidence chain. Chain verification is available on paid
        plans (Standard, Plus, Deep Dive, Forensic).
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <dt className="text-xs text-stone-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm font-medium text-stone-900 text-right">{value}</dd>
    </div>
  );
}
