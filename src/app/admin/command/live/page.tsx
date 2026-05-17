import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { LiveGrid } from '@/components/admin/command/live-grid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LivePage() {
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
  if (!user) redirect('/login?from=/admin/command/live');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

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
          <h1 className="font-serif text-3xl text-stone-900 mt-1">Live</h1>
          <p className="text-sm text-stone-600 mt-1">Everyone on earthmove.io right now</p>
        </header>
        <LiveGrid />
      </div>
    </main>
  );
}
