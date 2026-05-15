import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { FunnelCard } from '@/components/admin/command/funnel-card';
import { FUNNELS, type FunnelStep, type FunnelDef } from '@/lib/admin/funnels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type FunnelResult = {
  funnel: FunnelDef
  steps: FunnelStep[]
  error?: string
}

export default async function FunnelsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {/* read-only */},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?from=/admin/command/funnels');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  const results: FunnelResult[] = await Promise.all(
    FUNNELS.map(async (funnel): Promise<FunnelResult> => {
      const { data, error } = await supabase.rpc(funnel.rpc_name, {
        since_hours: funnel.default_window_hours,
      });
      if (error) {
        return { funnel, steps: [], error: error.message };
      }
      return { funnel, steps: (data ?? []) as FunnelStep[] };
    })
  );

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-6">
          <Link
            href="/admin/command"
            className="text-xs uppercase tracking-wide text-stone-500 hover:text-stone-700"
          >
            ← Queue
          </Link>
          <h1 className="font-serif text-3xl text-stone-900 mt-1">Funnels</h1>
          <p className="text-sm text-stone-600 mt-1">
            Conversion funnels across the five primary flows. Refresh the page to update.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.map((r) => (
            <FunnelCard
              key={r.funnel.id}
              funnel={r.funnel}
              steps={r.steps}
              error={r.error}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
