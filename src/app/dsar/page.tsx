'use client';
import { useState } from 'react';
export default function DsarPage() {
  const [type, setType] = useState<'access'|'portability'|'rectification'|'restriction'|'objection'>('access');
  const [erase, setErase] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const endpoint = erase ? '/api/dsar/erasure' : '/api/dsar/request';
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(erase ? { subjectEmail: email, reason } : { requestType: type, subjectEmail: email }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'submission_failed');
      setSubmitted({ id: j.id });
    } catch (e) { setErr(e instanceof Error ? e.message : 'error'); } finally { setBusy(false); }
  }
  if (submitted) return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Request received</h1>
      <p className="mt-4 text-stone-600">Your request reference is <code className="rounded bg-stone-100 px-2 py-1 font-mono">{submitted.id}</code>. We&apos;ll verify your identity via email and fulfill within 30 days per GDPR Article 15/17 and CCPA §1798.110/.105.</p>
    </main>
  );
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Data subject request</h1>
      <p className="mt-2 text-stone-600">Exercise your rights under GDPR (Articles 15-22) or CCPA (§§1798.100-.150). All valid requests fulfilled within 30 days at no charge.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={erase} onChange={(e) => setErase(e.target.checked)} className="mt-1" />
          <div><div className="font-medium">Request data erasure (GDPR Article 17 / CCPA §1798.105)</div><div className="text-xs text-stone-500">Delete or anonymize your personal data. Some records may be retained where legally required (financial records under 7-year retention).</div></div>
        </label>
        {!erase && (
          <div>
            <label className="block text-sm font-medium mb-1">Request type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full rounded ring-1 ring-stone-300 px-3 py-2 text-sm">
              <option value="access">Access — provide a copy of my data (Article 15)</option>
              <option value="portability">Portability — export in machine-readable format (Article 20)</option>
              <option value="rectification">Rectification — correct inaccurate data (Article 16)</option>
              <option value="restriction">Restriction — limit processing (Article 18)</option>
              <option value="objection">Objection — stop specific processing (Article 21)</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Email of the data subject</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded ring-1 ring-stone-300 px-3 py-2 text-sm" placeholder="you@example.com" />
          <p className="mt-1 text-xs text-stone-500">We&apos;ll send a verification link before processing.</p>
        </div>
        {erase && (
          <div><label className="block text-sm font-medium mb-1">Reason (optional)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="w-full rounded ring-1 ring-stone-300 px-3 py-2 text-sm" /></div>
        )}
        <button type="submit" disabled={busy || !email} className="rounded bg-emerald-600 text-white px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Submitting...' : 'Submit request'}</button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </form>
      <p className="mt-10 text-xs text-stone-500">Questions? <a href="mailto:privacy@earthmove.io" className="underline">privacy@earthmove.io</a></p>
    </main>
  );
}
