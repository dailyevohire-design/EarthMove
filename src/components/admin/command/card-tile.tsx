'use client';

import { useState } from 'react';
import { type InterventionCard, severityClasses, timeAgo } from '@/lib/admin/cards';

type Props = {
  card: InterventionCard;
  currentUserId: string;
  onMutated?: () => void;
};

type Toast = { kind: 'error' | 'success'; text: string } | null;

export function CardTile({ card, currentUserId, onMutated }: Props) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/cards/${card.id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setToast({ kind: 'error', text: 'Card was modified — refreshing' });
        onMutated?.();
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'request_failed' }));
        setToast({ kind: 'error', text: String(j.error ?? 'request failed') });
        return;
      }
      onMutated?.();
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const isOpen = card.status === 'open';
  const isClaimed = card.status === 'claimed';
  const isSnoozed = card.status === 'snoozed';
  const isTerminal = card.status === 'resolved' || card.status === 'dismissed';
  const claimedByMe = isClaimed && card.claimed_by === currentUserId;
  const claimedByOther = isClaimed && card.claimed_by !== currentUserId;

  const phone = typeof card.payload?.phone === 'string' ? (card.payload.phone as string) : null;
  const suggestedAction = card.payload?.suggested_action as { type?: string; copy?: string } | undefined;
  const smsCopy = suggestedAction?.copy ?? null;
  const showSmsAction = card.rule_key === 'groundcheck_abandon_recoverable' && phone && smsCopy && claimedByMe;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${severityClasses(card.severity)}`}>
            {card.severity}
          </span>
          <span className="text-[10px] text-stone-400 font-mono">{card.rule_key}</span>
        </div>
        <span className="text-[10px] text-stone-400">{timeAgo(card.created_at)}</span>
      </div>

      <h3 className="text-sm font-semibold text-stone-900 mb-1">{card.title}</h3>
      {card.body && (
        <p className="text-xs text-stone-600 line-clamp-3 mb-2">{card.body}</p>
      )}

      <PayloadChips card={card} />

      {isClaimed && (
        <div className="mt-2 text-[11px] text-stone-500">
          👤 Claimed by {claimedByMe ? 'you' : 'admin'} {timeAgo(card.claimed_at)}
        </div>
      )}
      {isSnoozed && (
        <div className="mt-2 text-[11px] text-stone-500">
          💤 Snoozed until {card.snoozed_until ? new Date(card.snoozed_until).toLocaleString() : '—'}
        </div>
      )}
      {isTerminal && (
        <div className="mt-2 text-[11px] text-stone-500">
          {card.status === 'resolved' ? '✓ Resolved' : '✕ Dismissed'} {timeAgo(card.resolved_at)}
          {card.resolution_note && <span className="block text-stone-400 italic mt-0.5">&ldquo;{card.resolution_note}&rdquo;</span>}
        </div>
      )}

      {showSmsAction && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <a
            href={`sms:${phone}?body=${encodeURIComponent(smsCopy!)}`}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
          >
            📱 Send recovery SMS
          </a>
          <p className="mt-1 text-[10px] text-stone-400 italic">
            Will send: {smsCopy!.slice(0, 80)}{smsCopy!.length > 80 ? '…' : ''}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => postAction({ action: 'resolve', note: 'Sent recovery SMS' })}
            className="mt-2 text-[11px] text-emerald-700 underline disabled:opacity-50"
          >
            Mark sent + resolve
          </button>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap gap-2">
        {isOpen && (
          <button
            type="button"
            disabled={busy}
            onClick={() => postAction({ action: 'claim' })}
            className="px-3 py-1.5 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50"
          >
            Claim
          </button>
        )}
        {claimedByMe && !resolveOpen && (
          <>
            <button type="button" disabled={busy} onClick={() => postAction({ action: 'snooze', duration_minutes: 60 })} className="px-2 py-1 rounded-md border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-50">
              Snooze 1h
            </button>
            <button type="button" disabled={busy} onClick={() => postAction({ action: 'snooze', duration_minutes: 240 })} className="px-2 py-1 rounded-md border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-50">
              Snooze 4h
            </button>
            <button type="button" disabled={busy} onClick={() => postAction({ action: 'snooze', duration_minutes: 1440 })} className="px-2 py-1 rounded-md border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-50">
              Snooze 1d
            </button>
            <button type="button" disabled={busy} onClick={() => setResolveOpen(true)} className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
              Resolve
            </button>
            <button type="button" disabled={busy} onClick={() => postAction({ action: 'dismiss' })} className="px-3 py-1 rounded-md border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 disabled:opacity-50">
              Dismiss
            </button>
          </>
        )}
        {claimedByMe && resolveOpen && (
          <div className="w-full">
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value.slice(0, 500))}
              placeholder="Resolution note (optional)…"
              rows={2}
              className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await postAction({ action: 'resolve', note: resolveNote || undefined });
                  setResolveOpen(false);
                  setResolveNote('');
                }}
                className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Save resolve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setResolveOpen(false); setResolveNote(''); }}
                className="px-2 py-1 rounded-md border border-stone-300 text-stone-700 text-xs hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {claimedByOther && (
          <span className="text-xs text-stone-400 italic">Claimed by another admin</span>
        )}
        {isSnoozed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => postAction({ action: 'wake' })}
            className="px-3 py-1.5 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50"
          >
            Wake
          </button>
        )}
      </div>

      {toast && (
        <div className={`mt-2 text-[11px] ${toast.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function PayloadChips({ card }: { card: InterventionCard }) {
  if (card.rule_key !== 'groundcheck_abandon_recoverable') return null;
  const phone = typeof card.payload?.phone === 'string' ? (card.payload.phone as string) : null;
  const searchCount = typeof card.payload?.search_count_7d === 'number' ? (card.payload.search_count_7d as number) : null;
  const lastClick = typeof card.payload?.last_click_at === 'string' ? (card.payload.last_click_at as string) : null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {phone && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-[11px] text-stone-700">
          📞 {phone}
        </span>
      )}
      {searchCount != null && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-[11px] text-stone-700">
          🔍 {searchCount} searches
        </span>
      )}
      {lastClick && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-[11px] text-stone-700">
          ⏱ Clicked {timeAgo(lastClick)}
        </span>
      )}
    </div>
  );
}
