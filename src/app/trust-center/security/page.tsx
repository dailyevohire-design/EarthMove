import Link from 'next/link';
import { getComplianceSnapshot } from '@/lib/compliance/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 300;
export const metadata = { title: 'Security · Trust Center' };

export default async function SecurityPage() {
  const snap = await getComplianceSnapshot();
  const s = (k: string) => (snap?.[k] as Record<string, number | string | null>) ?? {};

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-emerald-700"><Link href="/trust-center" className="hover:underline">Trust Center</Link> · Security</p>
      <h1 className="mt-2 text-3xl font-semibold">Security architecture</h1>
      <p className="mt-2 max-w-2xl text-stone-600">Defense in depth. Every layer assumes the layer above could be compromised.</p>

      <Section title="Encryption">
        <Row left="At rest" right="AES-256-GCM (AWS KMS managed via Supabase)" />
        <Row left="In transit" right="TLS 1.2+ with HSTS preload (max-age=63072000)" />
        <Row left="Application layer" right="Supabase Vault (XChaCha20-Poly1305) for sensitive secrets" />
        <Row left="Key rotation" right={`${s('encryption_keys').total ?? 6} keys inventoried · ${s('encryption_keys').rotation_overdue ?? 0} overdue`} />
      </Section>

      <Section title="Identity & access">
        <Row left="Authentication" right="Supabase Auth — magic link + TOTP MFA" />
        <Row left="MFA enrollment (admin)" right={`${s('identity').mfa_enrolled ?? 0} of ${s('identity').admin_users ?? '—'}`} />
        <Row left="RBAC" right="5 roles enforced via RLS (customer, supplier, admin, gc, driver)" />
        <Row left="SSO / SAML" right="Available on Enterprise tier (Q4 2026)" />
        <Row left="SCIM provisioning" right="Available on Enterprise tier (Q1 2027)" />
        <Row left="Failed-auth lockout" right="5 attempts / 15 min = lock + IP ban" />
        <Row left="Quarterly access review" right={`Next due ${s('access_reviews').next_due ?? '—'}`} />
      </Section>

      <Section title="Data protection">
        <Row left="Row-level security" right="Enabled on every public table; default-deny" />
        <Row left="Data classification" right={`${s('data_classification').columns_classified ?? 0} PII columns tagged (${s('data_classification').restricted_columns ?? 0} restricted, ${s('data_classification').confidential_columns ?? 0} confidential)`} />
        <Row left="Audit immutability" right="DB-level append-only + Merkle hash chain on admin actions (tamper-evident)" />
        <Row left="Backup" right="Daily Supabase PITR · heartbeat-verified · quarterly restore drills" />
        <Row left="Data residency" right="United States (us-east-1)" />
        <Row left="Customer-managed keys (BYOK)" right="On Enterprise tier roadmap (Q2 2027)" />
      </Section>

      <Section title="Application & network">
        <Row left="Content Security Policy" right="strict-dynamic + per-request nonce + report-to" />
        <Row left="Security headers" right="HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin" />
        <Row left="Rate limiting" right="Sliding-window per-endpoint with X-RateLimit headers" />
        <Row left="Honeypot trap" right="16 paths → auto-ban 7d on first hit" />
        <Row left="Webhook verification" right="HMAC-SHA256 (Stripe), HMAC-SHA1 (Twilio), secret-path (SendGrid)" />
        <Row left="DDoS protection" right="Vercel edge + Cloudflare upstream" />
      </Section>

      <Section title="Threat detection">
        <Row left="Prompt-injection sanitizer" right="On every LLM-bound input + scraped evidence (sentinel-wrapped)" />
        <Row left="GPS spoof gate" right="Server-side velocity / accel / accuracy / teleport detection" />
        <Row left="Trust score anomaly" right="Velocity + score-pump triggers raise critical intervention cards" />
        <Row left="RLS regression alert" right="Nightly scan; new violations raise immediate alert" />
        <Row left="Canary network" right="Trip-wires across supplier listings + trust subjects" />
      </Section>

      <Section title="Vulnerability management">
        <Row left="Dependency scanning" right="GitHub Dependabot + Snyk in CI" />
        <Row left="Static analysis" right="Semgrep + CodeQL in CI" />
        <Row left="Secret scanning" right="GitHub Advanced Security + pre-commit hooks" />
        <Row left="SBOM generation" right="CycloneDX on every release tag" />
        <Row left="Penetration testing" right="Annual third-party · next Q3 2026" />
        <Row left="Vulnerability disclosure" right={<Link href="/.well-known/security.txt" className="text-emerald-700 hover:underline">security.txt + VDP</Link>} />
      </Section>

      <Section title="Incident response">
        <Row left="Detection" right="Real-time via security command center + Realtime push" />
        <Row left="Classification" right="SEV1–SEV4 with documented playbooks" />
        <Row left="Customer notification SLA" right="72 hours from confirmed personal data breach" />
        <Row left="Open incidents" right={`${s('incidents').open ?? 0} · ${s('incidents').sev1_or_2_open ?? 0} critical`} />
        <Row left="Audit chain integrity" right={<Link href="/admin/compliance/integrity" className="text-emerald-700 hover:underline">verifiable Merkle proof</Link>} />
      </Section>

      <p className="mt-10 text-xs text-stone-500">Last updated {new Date().toISOString().slice(0,10)}.</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="mt-8"><h2 className="text-lg font-medium mb-3">{title}</h2><dl className="rounded-lg ring-1 ring-stone-200 bg-white divide-y divide-stone-100">{children}</dl></section>);
}
function Row({ left, right }: { left: string; right: React.ReactNode }) {
  return (<div className="flex items-baseline justify-between gap-4 px-4 py-3"><dt className="text-sm text-stone-600 shrink-0">{left}</dt><dd className="text-sm text-right text-stone-900">{right}</dd></div>);
}
