import { redirect } from 'next/navigation';
import { createSecurityClient } from '@/lib/security/server-client';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDetail() {
  const sb = createSecurityClient();
  const [hp, inj, gps, auth, can] = await Promise.all([
    sb.from('honeypot_hits').select('*').order('hit_at', { ascending: false }).limit(50),
    sb.from('ai_injection_attempts').select('*').order('detected_at', { ascending: false }).limit(50),
    sb.from('gps_anomalies').select('*').order('detected_at', { ascending: false }).limit(50),
    sb.from('failed_auth').select('*').order('attempted_at', { ascending: false }).limit(50),
    sb.from('canary_hits').select('*').order('hit_at', { ascending: false }).limit(50),
  ]);
  return { hp: hp.data ?? [], inj: inj.data ?? [], gps: gps.data ?? [], auth: auth.data ?? [], can: can.data ?? [] };
}

export default async function ThreatsPage() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security/threats');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }
  const d = await getDetail();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Recent threats</h1>

      <Section title="Canary hits (CRITICAL — confirmed exfiltration signals)" empty="No canary triggers · no data leaks detected">
        {d.can.map((r) => (
          <li key={r.id} className="border-b border-stone-100 py-2 text-sm">
            <span className="font-mono">{r.hit_source}</span> · {r.caller_id ?? r.email_from} · {new Date(r.hit_at).toLocaleString()}
          </li>
        ))}
      </Section>

      <Section title="Honeypot hits" empty="No probes detected">
        {d.hp.map((r) => (
          <li key={r.id} className="border-b border-stone-100 py-2 text-sm">
            <span className="font-mono">{String(r.ip)}</span> {r.method} <span className="font-mono">{r.path}</span> · {new Date(r.hit_at).toLocaleString()}
          </li>
        ))}
      </Section>

      <Section title="AI injection attempts" empty="No injection patterns detected">
        {d.inj.map((r) => (
          <li key={r.id} className="border-b border-stone-100 py-2 text-sm">
            <span className="font-mono">{r.source}</span> · {r.action_taken} · <span className="text-stone-500">{new Date(r.detected_at).toLocaleString()}</span>
            <div className="mt-1 font-mono text-xs text-stone-600">{r.excerpt}</div>
          </li>
        ))}
      </Section>

      <Section title="GPS anomalies" empty="No GPS anomalies detected">
        {d.gps.map((r) => (
          <li key={r.id} className="border-b border-stone-100 py-2 text-sm">
            driver <span className="font-mono">{r.driver_id?.slice(0, 8)}</span> · {r.anomaly_type} · computed {r.computed_value} vs threshold {r.threshold} · {new Date(r.detected_at).toLocaleString()}
          </li>
        ))}
      </Section>

      <Section title="Failed auth" empty="No failed auth attempts">
        {d.auth.map((r) => (
          <li key={r.id} className="border-b border-stone-100 py-2 text-sm">
            <span className="font-mono">{r.identifier}</span> from <span className="font-mono">{String(r.ip)}</span> · {r.reason} · {new Date(r.attempted_at).toLocaleString()}
          </li>
        ))}
      </Section>
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-stone-500">{empty}</p> : <ul className="mt-2">{children}</ul>}
    </section>
  );
}
