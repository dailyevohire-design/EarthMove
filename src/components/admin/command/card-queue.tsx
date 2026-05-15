'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CardTile } from './card-tile';
import { type InterventionCard, SEVERITY_RANK } from '@/lib/admin/cards';

type Filter = 'all' | 'open' | 'mine' | 'snoozed' | 'resolved';

type Props = {
  initialCards: InterventionCard[];
  currentUserId: string;
};

export function CardQueue({ initialCards, currentUserId }: Props) {
  const [cards, setCards] = useState<Map<string, InterventionCard>>(() => {
    const m = new Map<string, InterventionCard>();
    for (const c of initialCards) m.set(c.id, c);
    return m;
  });
  const [filter, setFilter] = useState<Filter>('open');
  const [resolvedFetched, setResolvedFetched] = useState(false);
  const [resolvedLoading, setResolvedLoading] = useState(false);

  // Realtime subscription on intervention_cards
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const channel = supabase
      .channel('admin_intervention_cards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intervention_cards' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<InterventionCard>;
            if (!old.id) return;
            setCards((prev) => {
              if (!prev.has(old.id!)) return prev;
              const next = new Map(prev);
              next.delete(old.id!);
              return next;
            });
            return;
          }
          const row = payload.new as InterventionCard;
          if (!row?.id) return;
          setCards((prev) => {
            const next = new Map(prev);
            next.set(row.id, row);
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Lazy-fetch resolved/dismissed when filter switches to 'resolved' the first time
  useEffect(() => {
    if (filter !== 'resolved' || resolvedFetched) return;
    setResolvedLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase
      .from('intervention_cards')
      .select('*')
      .in('status', ['resolved', 'dismissed'])
      .order('resolved_at', { ascending: false, nullsFirst: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setCards((prev) => {
            const next = new Map(prev);
            for (const c of data as InterventionCard[]) next.set(c.id, c);
            return next;
          });
        }
        setResolvedFetched(true);
        setResolvedLoading(false);
      });
  }, [filter, resolvedFetched]);

  const list = useMemo(() => {
    const all = Array.from(cards.values());
    const filtered = all.filter((c) => {
      if (filter === 'all') return true;
      if (filter === 'open') return c.status === 'open';
      if (filter === 'mine') return c.status === 'claimed' && c.claimed_by === currentUserId;
      if (filter === 'snoozed') return c.status === 'snoozed';
      if (filter === 'resolved') return c.status === 'resolved' || c.status === 'dismissed';
      return true;
    });
    filtered.sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity] ?? 9;
      const sb = SEVERITY_RANK[b.severity] ?? 9;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return filtered;
  }, [cards, filter, currentUserId]);

  const counts = useMemo(() => {
    let open = 0, claimed = 0, snoozed = 0;
    for (const c of cards.values()) {
      if (c.status === 'open') open++;
      else if (c.status === 'claimed') claimed++;
      else if (c.status === 'snoozed') snoozed++;
    }
    return { open, claimed, snoozed };
  }, [cards]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'open', label: `Open (${counts.open})` },
    { key: 'mine', label: 'Mine' },
    { key: 'snoozed', label: `Snoozed (${counts.snoozed})` },
    { key: 'all', label: 'All' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              filter === f.key
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {resolvedLoading && filter === 'resolved' && (
        <p className="text-xs text-stone-500 mb-3">Loading resolved cards…</p>
      )}

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 p-12 text-center text-stone-500">
          <p className="text-sm">No cards in this filter.</p>
          <p className="text-xs mt-1 text-stone-400">Cards appear here when intervention rules fire.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => (
            <CardTile key={c.id} card={c} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
