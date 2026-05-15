import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSecuritySnapshot, getRecentSecurityCards } from '@/lib/security/snapshot';
import { LiveThreatStrip } from './_components/LiveThreatStrip';
import { SecurityCardRow } from './_components/SecurityCardRow';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/security/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecurityCommandCenter() {
  try { await requireAdmin(); }
  catch (e) {
    if (e instanceof UnauthorizedError) redirect('/login?next=/admin/security');
    if (e instanceof ForbiddenError) redirect('/');
    throw e;
  }

  const [snap, cards] = await Promise.all([
    getSecuritySnapshot(),
    getRecentSecurityCards(50),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Security command center</h1>
          <p className="mt-1 text-sm text-stone-500">
            Every detection here is a real protection — for families hiring contractors,
            drivers on the road, suppliers being scraped, and reports being poisoned.
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/security/canaries" className="text-stone-600 hover:text-stone-900 hover:underline">Canaries</Link>
          <Link href="/admin/security/rls"      className="text-stone-600 hover:text-stone-900 hover:underline">RLS</Link>
          <Link href="/admin/security/bans"     className="text-stone-600 hover:text-stone-900 hover:underline">Bans</Link>
          <Link href="/admin/security/threats"  className="text-stone-600 hover:text-stone-900 hover:underline">Threat log</Link>
          <Link href="/admin/security/audit"    className="text-stone-600 hover:text-stone-900 hover:underline">Admin audit</Link>
        </nav>
      </div>

      <LiveThreatStrip initial={snap} />

      <section>
        <h2 className="text-lg font-medium mb-3">Live security cards</h2>
        {cards.length === 0 ? (
          <div className="rounded-lg ring-1 ring-emerald-200 bg-emerald-50 px-4 py-6 text-sm text-emerald-800 text-center">
            No security events yet · all systems clean
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((c) => <SecurityCardRow key={c.id} card={c} />)}
          </div>
        )}
      </section>
    </main>
  );
}
