'use client';

import Link from 'next/link';
import { Monitor, Smartphone, Tablet, ShoppingCart, Search } from 'lucide-react';
import {
  type LiveSession,
  flagEmoji,
  timeAgo,
  durationLabel,
  roleBadge,
  formatCents,
} from '@/lib/admin/format-session';

function DeviceIcon({ d }: { d: 'mobile' | 'desktop' | 'tablet' }) {
  if (d === 'mobile') return <Smartphone className="w-3 h-3" />;
  if (d === 'tablet') return <Tablet className="w-3 h-3" />;
  return <Monitor className="w-3 h-3" />;
}

export function LiveSessionTile({ s }: { s: LiveSession }) {
  const badge = roleBadge(s.role);
  const highValue = s.has_cart && s.cart_value_cents >= 100000; // ≥ $1,000
  const clickable = Boolean(s.user_id);
  const target = s.user_id ? `/admin/command/timeline/customer/${s.user_id}` : '#';

  const body = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ring-1 ring-inset ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-[10px] text-stone-400">{timeAgo(s.first_seen_at)} on site</span>
      </div>

      <div className="font-mono text-[11px] text-stone-700 break-all line-clamp-1">
        {s.current_path ?? '—'}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <span className="text-sm leading-none">{flagEmoji(s.country)}</span>
          <span className="truncate">
            {[s.city, s.region].filter(Boolean).join(', ') || s.country || '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-stone-400">
          <DeviceIcon d={s.device} />
        </div>
      </div>

      {(s.has_cart || s.has_groundcheck) && (
        <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
          {s.has_cart && (
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <ShoppingCart className="w-3 h-3" />
              {formatCents(s.cart_value_cents)} · {s.cart_item_count}
            </div>
          )}
          {s.has_groundcheck && (
            <div className="flex items-center gap-1 text-violet-700">
              <Search className="w-3 h-3" />
              groundcheck
            </div>
          )}
        </div>
      )}

      <div className="mt-2 text-[10px] text-stone-400 flex items-center justify-between">
        <span>
          {s.page_view_count} {s.page_view_count === 1 ? 'page' : 'pages'} · {durationLabel(s.first_seen_at)}
        </span>
        {s.utm_source && <span className="truncate ml-2">via {s.utm_source}</span>}
      </div>
    </>
  );

  const baseCls = `block rounded-lg bg-white border ${
    highValue ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'
  } p-3 text-sm transition`;

  if (clickable) {
    return (
      <Link href={target} className={`${baseCls} hover:border-stone-300 hover:shadow-sm group`}>
        {body}
      </Link>
    );
  }
  return <div className={`${baseCls} cursor-default`}>{body}</div>;
}
