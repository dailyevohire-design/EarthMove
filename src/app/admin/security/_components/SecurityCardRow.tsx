'use client';

import { useState, useTransition } from 'react';
import { claimCardAction, resolveCardAction, snoozeCardAction, dismissCardAction } from '../actions';
import type { SecurityCard } from '@/lib/security/snapshot';

type Props = { card: SecurityCard };

export function SecurityCardRow({ card }: Props) {
  const [pending, startTransition] = useTransition();
  const [resNote, setResNote] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sevColor = card.severity === 'critical' ? 'bg-red-100 text-red-800 ring-red-300' :
                   card.severity === 'warn'     ? 'bg-amber-100 text-amber-800 ring-amber-300' :
                                                  'bg-stone-100 text-stone-700 ring-stone-200';
  const statusBadge = card.status === 'open' ? 'bg-emerald-100 text-emerald-800' :
                      card.status === 'claimed' ? 'bg-sky-100 text-sky-800' :
                      card.status === 'snoozed' ? 'bg-stone-100 text-stone-600' :
                      'bg-stone-200 text-stone-700';

  function run(p: Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await p;
      if (!r.ok) setErr(r.error ?? 'error'); else setErr(null);
    });
  }

  return (
    <div className="rounded-lg ring-1 ring-stone-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`rounded px-1.5 py-0.5 text-xs font-mono ring-1 ${sevColor}`}>{card.severity}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${statusBadge}`}>{card.status}</span>
            <span className="text-xs text-stone-400 font-mono">{card.rule_key}</span>
            <span className="text-xs text-stone-400 ml-auto">{new Date(card.created_at).toLocaleString()}</span>
          </div>
          <div className="text-sm font-medium">{card.title}</div>
          {card.body && <div className="text-xs text-stone-600 mt-1">{card.body}</div>}
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs text-stone-500 underline shrink-0">{open ? 'less' : 'actions'}</button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap gap-2 items-center">
          {card.status === 'open' && (
            <button disabled={pending} onClick={() => run(claimCardAction(card.id))}
                    className="text-xs rounded bg-sky-600 px-2.5 py-1 text-white disabled:opacity-50">Claim</button>
          )}
          {(card.status === 'open' || card.status === 'claimed') && (
            <>
              <input value={resNote} onChange={(e) => setResNote(e.target.value)} placeholder="Resolution note (max 500 chars)"
                     maxLength={500}
                     className="text-xs rounded ring-1 ring-stone-300 px-2 py-1 min-w-[240px]" />
              <button disabled={pending} onClick={() => run(resolveCardAction(card.id, resNote))}
                      className="text-xs rounded bg-emerald-600 px-2.5 py-1 text-white disabled:opacity-50">Resolve</button>
              <button disabled={pending} onClick={() => run(snoozeCardAction(card.id, 60))}
                      className="text-xs rounded bg-stone-200 px-2.5 py-1 text-stone-700 disabled:opacity-50">Snooze 1h</button>
              <button disabled={pending} onClick={() => run(dismissCardAction(card.id, resNote || 'False positive'))}
                      className="text-xs rounded bg-stone-100 px-2.5 py-1 text-stone-600 disabled:opacity-50">Dismiss</button>
            </>
          )}
          {err && <span className="text-xs text-red-600">{err}</span>}
          {Object.keys(card.payload ?? {}).length > 0 && (
            <details className="text-xs text-stone-500 w-full">
              <summary className="cursor-pointer">payload</summary>
              <pre className="mt-1 p-2 bg-stone-50 rounded text-[10px] overflow-x-auto">{JSON.stringify(card.payload, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
