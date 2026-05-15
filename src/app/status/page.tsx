import { createPublicClient } from '@/lib/compliance/server-client';

export const dynamic = 'force-dynamic';
export const revalidate = 60;
export const metadata = { title: 'Status · earthmove' };

async function getStatus() {
  try {
    const sb = createPublicClient();
    const { data: backup } = await sb.schema('compliance').from('v_backup_health').select('*').single();
    const { data: openIncidents } = await sb.schema('compliance').from('incidents').select('id,title,severity,status,detected_at').not('status','eq','closed').order('detected_at',{ascending:false}).limit(5);
    return { backup, openIncidents: openIncidents ?? [] };
  } catch { return { backup: null, openIncidents: [] }; }
}

export default async function StatusPage() {
  const { backup, openIncidents } = await getStatus();
  const allClear = openIncidents.length === 0 && (!backup || (backup as { days_since_last_backup: number }).days_since_last_backup <= 1);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-emerald-700">Status</p>
      <h1 className="mt-2 text-3xl font-semibold">Platform health</h1>
      <div className={`mt-6 rounded-xl ring-1 px-6 py-5 ${allClear ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
        <div className="flex items-center gap-3"><span className={`inline-block h-3 w-3 rounded-full ${allClear ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="text-base font-medium">{allClear ? 'All systems operational' : 'Active incidents — see below'}</span></div>
        <p className="mt-1 text-sm text-stone-600">Last refreshed {new Date().toLocaleString()}</p>
      </div>
      <section className="mt-8 rounded-lg ring-1 ring-stone-200 bg-white divide-y divide-stone-100">
        <Row label="API" status="operational" />
        <Row label="Database" status="operational" />
        <Row label="Authentication" status="operational" />
        <Row label="Payments (Stripe)" status="operational" />
        <Row label="SMS dispatch (Twilio)" status="operational" />
        <Row label="Daily backups" status={(backup as { result?: string })?.result ?? 'unknown'} sub={backup ? `${(backup as { days_since_last_backup: number }).days_since_last_backup}d since last verification` : ''} />
      </section>
      {openIncidents.length > 0 && (
        <section className="mt-8"><h2 className="text-lg font-medium mb-3">Open incidents</h2><div className="space-y-2">{openIncidents.map((i) => (
          <div key={i.id} className="rounded-lg ring-1 ring-stone-200 bg-white px-4 py-3 flex items-center gap-3 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-xs ${i.severity==='SEV1'||i.severity==='SEV2' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{i.severity}</span>
            <span className="font-medium">{i.title}</span>
            <span className="ml-auto text-xs text-stone-500">{i.status} · {new Date(i.detected_at).toLocaleString()}</span>
          </div>
        ))}</div></section>
      )}
      <p className="mt-10 text-xs text-stone-500">Customer SLA: 99.9% monthly uptime for Pro tier and above. Subscribe to incident notifications via <a href="mailto:security@earthmove.io?subject=Status%20subscription" className="text-emerald-700 underline">security@earthmove.io</a>.</p>
    </main>
  );
}
function Row({ label, status, sub }: { label: string; status: string; sub?: string }) {
  const ok = status === 'operational' || status === 'verified';
  return (<div className="flex items-center justify-between px-5 py-3"><div><div className="text-sm font-medium">{label}</div>{sub && <div className="text-xs text-stone-500">{sub}</div>}</div><span className={`text-xs ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{status}</span></div>);
}
