import Link from 'next/link';
import {
  Wordmark,
  SectionLabel,
  DisplayH1,
  Lozenge,
  StatusPill,
  DarkPanel,
} from '@/components/design-system/earthmove-ds';
import { DEALS, REASON_EXPLAINERS, type DealReason } from './deals-data';

export const metadata = {
  title: 'Deals - EarthMove',
  description:
    'Below-book aggregate pricing in Dallas-Fort Worth. Real yards, real reasons, real expiry windows.',
};

export default function DealsPage() {
  const cheapestPerTon = Math.min(...DEALS.map((d) => d.nowPerTon));
  const totalTonsAvailable = DEALS.reduce((acc, d) => acc + d.tonsLeft, 0);

  return (
    <main style={{ background: 'var(--em-paper)', minHeight: '100vh' }} className="font-sans">
      <nav
        className="flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: 'var(--em-hair)' }}
      >
        <Wordmark href="/">EarthMove</Wordmark>
        <div className="flex items-center gap-7 text-sm" style={{ color: 'var(--em-ink-2)' }}>
          <Link href="/browse" className="hover:underline underline-offset-4">Materials</Link>
          <Link href="/deals" className="font-semibold" style={{ color: 'var(--em-ink)' }}>Deals</Link>
          <Link href="/browse" className="hover:underline underline-offset-4">Place order</Link>
          <Link href="/dashboard/contractor" className="hover:underline underline-offset-4">Dashboard</Link>
        </div>
      </nav>

      <section className="max-w-[1200px] mx-auto px-8 pt-12 pb-10">
        <div className="flex items-start justify-between gap-12 flex-wrap">
          <div className="max-w-[640px]">
            <SectionLabel>Below book - Dallas-Fort Worth - this week</SectionLabel>
            <DisplayH1 size="lg" className="mt-4">
              Real yards, real reasons, <em>real expiry windows.</em>
            </DisplayH1>
            <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
              Six deals open right now across DFW. Each one carries the cause - stockpile clear, quarry overrun, weekend window. No fake urgency. When the timer hits zero or the tons run out, the deal closes.
            </p>
          </div>

          <DarkPanel className="min-w-[280px]" style={{ padding: 20 }} eyebrow={undefined} eyebrowNum={undefined}>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.10em] opacity-70 mb-2">
              DFW market - live
            </div>
            <div className="font-display text-[28px] font-semibold leading-none">
              ${cheapestPerTon}
              <span className="text-[14px] font-sans font-medium opacity-70 ml-1">/ ton low</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/15 text-[12px] opacity-80">
              <span className="font-mono">{totalTonsAvailable.toLocaleString()} tons</span> available across{' '}
              <span className="font-mono">{DEALS.length} yards</span>
            </div>
          </DarkPanel>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEALS.map((deal) => {
            const pctRemaining = Math.round((deal.tonsLeft / deal.tonsTotal) * 100);
            const isLowStock = pctRemaining < 25;
            return (
              <article
                key={deal.id}
                className="relative bg-white rounded-[18px] p-6 flex flex-col gap-4"
                style={{ border: '1px solid var(--em-hair)' }}
              >
                <div
                  className="absolute -top-3 right-5 font-mono text-[11px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded"
                  style={{ background: 'var(--em-orange)', color: 'white' }}
                >
                  <span className="line-through opacity-60 mr-2">${deal.wasPerTon}</span>
                  <span>${deal.nowPerTon}/t</span>
                </div>

                <div>
                  <div
                    className="font-display text-[22px] font-semibold leading-tight"
                    style={{ color: 'var(--em-ink)', letterSpacing: '-0.01em' }}
                  >
                    {deal.material}
                  </div>
                  <div className="mt-1 text-[12px] font-mono" style={{ color: 'var(--em-ink-3)' }}>
                    {deal.spec}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Lozenge>{deal.yardName.toUpperCase()}</Lozenge>
                  <span className="text-[12px]" style={{ color: 'var(--em-ink-3)' }}>
                    {deal.yardCity}
                  </span>
                </div>

                <div>
                  <div
                    className="flex items-center justify-between text-[11px] font-mono mb-1.5"
                    style={{ color: 'var(--em-ink-2)' }}
                  >
                    <span>
                      {deal.tonsLeft.toLocaleString()} of {deal.tonsTotal.toLocaleString()} tons left
                    </span>
                    <span style={{ color: isLowStock ? 'var(--em-amber-soft)' : 'var(--em-ink-3)' }}>
                      {pctRemaining}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--em-card-muted)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${pctRemaining}%`,
                        background: isLowStock ? 'var(--em-amber)' : 'var(--em-emerald-soft)',
                      }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between gap-3 mt-auto pt-4"
                  style={{ borderTop: '1px solid var(--em-hair)' }}
                >
                  <span
                    className="text-[11px] font-mono uppercase tracking-wider"
                    style={{ color: 'var(--em-ink-3)' }}
                  >
                    {deal.reasonLabel}
                  </span>
                  <StatusPill variant={isLowStock ? 'warn' : 'default'}>
                    {deal.expiresLabel} - {deal.expiresIn}
                  </StatusPill>
                </div>

                <a
                  href={`/browse/${deal.slug}`}
                  className="block w-full text-center py-3 rounded-[10px] font-semibold text-[14px] transition-colors"
                  style={{ background: 'var(--em-orange)', color: 'white' }}
                >
                  Quote this deal -&gt;
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-8 pb-20">
        <SectionLabel muted>How deals work - three real reasons</SectionLabel>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(REASON_EXPLAINERS) as DealReason[]).map((reason) => {
            const sample = DEALS.find((d) => d.reason === reason);
            return (
              <div
                key={reason}
                className="p-5 rounded-[14px]"
                style={{ background: 'var(--em-card-muted)', border: '1px solid var(--em-hair)' }}
              >
                <div
                  className="font-mono text-[10.5px] font-semibold tracking-[0.10em] uppercase mb-2"
                  style={{ color: 'var(--em-ink-3)' }}
                >
                  {sample?.reasonLabel}
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>
                  {REASON_EXPLAINERS[reason]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: 'var(--em-hair)' }}>
        <div
          className="max-w-[1200px] mx-auto px-8 py-6 flex items-center justify-between text-[12px]"
          style={{ color: 'var(--em-ink-3)' }}
        >
          <span>EarthMove - Dallas-Fort Worth - Denver</span>
          <Link href="/" className="hover:underline underline-offset-4">Back to home</Link>
        </div>
      </footer>
    </main>
  );
}
