import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CardQueue } from '@/components/admin/command/card-queue';
import type { InterventionCard } from '@/lib/admin/cards';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CommandQueuePage() {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?from=/admin/command');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  // Severity is text — sort client-side via SEVERITY_RANK. Server only orders by recency.
  const { data: cards } = await supabase
    .from('intervention_cards')
    .select('*')
    .in('status', ['open', 'claimed', 'snoozed'])
    .order('created_at', { ascending: false })
    .limit(100);

  const initialCards = (cards ?? []) as InterventionCard[];
  let open = 0, claimed = 0, snoozed = 0;
  for (const c of initialCards) {
    if (c.status === 'open') open++;
    else if (c.status === 'claimed') claimed++;
    else if (c.status === 'snoozed') snoozed++;
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="font-serif text-3xl text-stone-900">Command Queue</h1>
          <p className="text-sm text-stone-600 mt-1">
            {open} open · {claimed} claimed · {snoozed} snoozed
          </p>
        </header>
        <CardQueue initialCards={initialCards} currentUserId={user.id} />
      </div>
    </main>
  );
}
