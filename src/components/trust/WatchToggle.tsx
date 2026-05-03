'use client';

import { useState, useEffect } from 'react';

interface WatchToggleProps {
  contractorId: string;
  contractorName?: string;
  initialActive?: boolean;
  initialSubscriptionId?: string;
}

/**
 * Per-contractor watchlist toggle. Renders on the /trust report page.
 * On click: POSTs to /api/trust/watch (subscribe) or DELETEs to
 * /api/trust/watch/[id] (unsubscribe). Optimistic UI; re-fetches state on
 * mount in case subscription was changed elsewhere.
 */
export function WatchToggle({
  contractorId,
  contractorName,
  initialActive,
  initialSubscriptionId,
}: WatchToggleProps) {
  const [active, setActive] = useState<boolean>(!!initialActive);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(initialSubscriptionId ?? null);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-sync state on mount (handles cross-device case where subscription
  // was created/removed elsewhere).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trust/watch?contractor_id=${contractorId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { subscription?: { id: string; active: boolean } | null }) => {
        if (cancelled) return;
        if (j.subscription) {
          setActive(!!j.subscription.active);
          setSubscriptionId(j.subscription.id);
        } else {
          setActive(false);
          setSubscriptionId(null);
        }
      })
      .catch(() => {
        // Silent — initial state from props remains.
      });
    return () => { cancelled = true; };
  }, [contractorId]);

  async function handleToggle() {
    if (pending) return;
    setPending(true);
    setErrorMsg(null);
    try {
      if (!active) {
        const res = await fetch('/api/trust/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ contractor_id: contractorId }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `subscribe failed (${res.status})`);
        }
        const j = (await res.json()) as { subscription: { id: string; active: boolean } };
        setSubscriptionId(j.subscription.id);
        setActive(true);
      } else if (subscriptionId) {
        const res = await fetch(`/api/trust/watch/${subscriptionId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `unsubscribe failed (${res.status})`);
        }
        setActive(false);
        setSubscriptionId(null);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  const label = active ? 'Watching' : 'Watch this contractor';
  const aria = active
    ? `Stop watching ${contractorName ?? 'this contractor'}`
    : `Watch ${contractorName ?? 'this contractor'} for new adverse evidence`;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-label={aria}
        className={
          'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition ' +
          (active
            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50') +
          (pending ? ' opacity-60 cursor-not-allowed' : '')
        }
      >
        <span aria-hidden="true">{active ? '✓' : '+'}</span>
        <span>{pending ? '…' : label}</span>
      </button>
      {errorMsg && <p className="text-xs text-red-700">{errorMsg}</p>}
    </div>
  );
}
