import Link from 'next/link';
import { SectionLabel, DisplayH1, Lozenge, DarkPanel } from '@/components/design-system/earthmove-ds';
import { WHAT_YOU_GET, WHAT_YOU_DO, TIMELINE, KIT_FILES, KIT_VERSION } from './kit-data';

export const metadata = {
  title: 'Contractor Payment Kit - EarthMove',
  description: 'Mechanics lien templates and a deadline calendar for Texas and Colorado. 49 dollars. Reviewed by counsel.',
};

const COUNSEL_TX = '<COUNSEL - TX>';
const COUNSEL_CO = '<COUNSEL - CO>';

export default function ContractorPaymentKitPage() {
  return (
    <div className="font-sans" style={{ color: 'var(--em-ink)' }}>
      <section className="pt-4 pb-10">
        <SectionLabel>Contractor payment kit - Texas and Colorado</SectionLabel>
        <DisplayH1 size="lg" className="mt-4">
          Get paid. <em>On the timeline the law gives you.</em>
        </DisplayH1>
        <p className="mt-5 text-[15px] leading-relaxed max-w-[680px]" style={{ color: 'var(--em-ink-2)' }}>
          A mechanics lien is the strongest leverage a contractor has when an owner stops paying. The catch is the deadlines. Miss them by a day and the lien is waived. This kit walks you through pre-lien notice, lien recording, demand letter, and release. Plain English, statutory templates, deadline calendar.
        </p>
      </section>

      <DarkPanel eyebrow={undefined} eyebrowNum={undefined} className="mb-10" style={{ padding: 32 }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="flex-1">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.10em] opacity-70">
              Digital download - {KIT_VERSION}
            </div>
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="font-display font-semibold leading-none" style={{ fontSize: 56, letterSpacing: '-0.02em' }}>$49</span>
              <span className="text-[14px] opacity-80">one-time - all 8 files - .docx and .pdf - lifetime updates for v3.x</span>
            </div>
          </div>
          <Link href="/orders/new?kit=contractor-payment-kit" className="block w-full md:w-auto text-center px-7 py-3.5 rounded-[10px] font-semibold text-[15px]" style={{ background: 'var(--em-orange)', color: 'white' }}>
            Buy the kit -&gt;
          </Link>
        </div>
      </DarkPanel>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        <article className="bg-white rounded-[18px] p-7" style={{ border: '1px solid var(--em-hair)' }}>
          <SectionLabel muted>What you get</SectionLabel>
          <ul className="mt-5 flex flex-col">
            {WHAT_YOU_GET.map((item, i) => {
              const isFirst = i === 0;
              const isLast = i === WHAT_YOU_GET.length - 1;
              const padCls = isFirst ? 'pb-5' : isLast ? 'pt-5' : 'py-5';
              const borderStyle = isLast ? undefined : { borderBottom: '1px solid var(--em-hair)' };
              return (
                <li key={item.id} className={padCls} style={borderStyle}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-[10.5px] font-semibold tracking-wider" style={{ color: 'var(--em-ink-3)' }}>0{i + 1}</span>
                    <h3 className="font-display text-[18px] font-semibold" style={{ color: 'var(--em-ink)', letterSpacing: '-0.01em' }}>{item.title}</h3>
                  </div>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>{item.body}</p>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="bg-white rounded-[18px] p-7" style={{ border: '1px solid var(--em-hair)' }}>
          <SectionLabel muted>What you do</SectionLabel>
          <ul className="mt-5 flex flex-col">
            {WHAT_YOU_DO.map((item, i) => {
              const isFirst = i === 0;
              const isLast = i === WHAT_YOU_DO.length - 1;
              const padCls = isFirst ? 'pb-5' : isLast ? 'pt-5' : 'py-5';
              const borderStyle = isLast ? undefined : { borderBottom: '1px solid var(--em-hair)' };
              return (
                <li key={item.id} className={padCls} style={borderStyle}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-[10.5px] font-semibold tracking-wider" style={{ color: 'var(--em-ink-3)' }}>0{i + 1}</span>
                    <h3 className="font-display text-[18px] font-semibold" style={{ color: 'var(--em-ink)', letterSpacing: '-0.01em' }}>{item.title}</h3>
                  </div>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>{item.body}</p>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      <section className="mb-12">
        <SectionLabel muted>From sent to paid</SectionLabel>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          {TIMELINE.map((step) => (
            <div key={step.step} className="p-5 rounded-[14px]" style={{ background: 'var(--em-card-muted)', border: '1px solid var(--em-hair)' }}>
              <div className="font-mono text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--em-ink-3)' }}>Step 0{step.step}</div>
              <div className="font-display text-[16px] font-semibold leading-tight mb-2" style={{ color: 'var(--em-ink)', letterSpacing: '-0.01em' }}>{step.label}</div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--em-ink-2)' }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionLabel muted>In the download</SectionLabel>
        <div className="mt-5 bg-white rounded-[18px] overflow-hidden" style={{ border: '1px solid var(--em-hair)' }}>
          <ul>
            {KIT_FILES.map((file, i) => {
              const isLast = i === KIT_FILES.length - 1;
              const borderStyle = isLast ? undefined : { borderBottom: '1px solid var(--em-hair)' };
              return (
                <li key={file.id} className="flex items-center justify-between gap-4 px-6 py-3.5" style={borderStyle}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="font-mono text-[10.5px] font-semibold tracking-wider flex-shrink-0" style={{ color: 'var(--em-ink-3)' }}>0{i + 1}</span>
                    <span className="text-[14px] font-medium truncate" style={{ color: 'var(--em-ink)' }}>{file.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--em-ink-3)' }}>{file.formats.join(' + ')} - {file.sizeKb} kb</span>
                    <Lozenge>{`REV ${file.reviewedAt.toUpperCase()}`}</Lozenge>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <div className="rounded-[14px] p-7" style={{ background: 'var(--em-card-muted)', border: '1px solid var(--em-hair-strong)' }}>
          <div className="font-mono text-[10.5px] font-semibold tracking-[0.14em] uppercase mb-4" style={{ color: 'var(--em-ink-3)' }}>
            Legal notice - scaffold (counsel replaces verbatim)
          </div>
          <div className="text-[13px] leading-relaxed space-y-3" style={{ color: 'var(--em-ink-2)' }}>
            <p>
              <strong>This kit is not legal advice and EarthMove is not your attorney.</strong> The documents are statutory templates reviewed by licensed counsel in the states for which they are provided. They are intended to give a contractor working without in-house counsel a starting point that follows the form and timing the statute requires. They are not a substitute for legal representation in any specific dispute.
            </p>
            <p>
              Mechanics lien rights, deadlines, and procedures vary by state and by the type of property and project. The templates here are scoped to Texas (Texas Property Code Chapter 53) and Colorado (Colorado Revised Statutes Title 38, Article 22). They are not adapted for other states. They are not adapted for federal projects, which use the Miller Act, or for state and municipal public works, which use Little Miller Acts and varying bond claim procedures. Do not file these documents in jurisdictions for which they were not drafted.
            </p>
            <p>
              The deadlines are unforgiving. A pre-lien notice sent one day late is waived. A lien recorded one day late is invalid. A demand letter that misstates the amount owed by a material margin can be used against you. Read the deadline calendar before you begin. If your facts do not match the calendar (the work was performed across multiple months, the contract was modified mid-project, the property changed ownership during the work, the project was federally funded), consult counsel before filing.
            </p>
            <p>
              By downloading this kit you acknowledge that no attorney-client relationship is created with EarthMove or with the counsel who reviewed the templates. The templates are provided as-is. Use at your own risk and discretion. If a particular dispute carries material consequences (the amount in question is significant relative to your business, the owner has retained counsel, the property is held in a trust or by a non-natural person, the project involves a public entity) retain your own attorney before sending any document from this kit.
            </p>
            <p className="pt-2" style={{ borderTop: '1px solid var(--em-hair)' }}>
              Texas templates reviewed by {COUNSEL_TX}. Colorado templates reviewed by {COUNSEL_CO}. Kit version {KIT_VERSION}. Counsel review is conducted on a kit-version basis. Statutory updates that occur between versions are reflected in the next release. To verify the version of the template you have, see the footer of each document.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 py-5 rounded-[14px]" style={{ background: 'white', border: '1px solid var(--em-hair)' }}>
          <div className="text-[13px]" style={{ color: 'var(--em-ink-2)' }}>
            Questions before you buy? <Link href="/contact" className="font-semibold underline underline-offset-4" style={{ color: 'var(--em-ink)' }}>Email the kit author</Link> - response within 24 hours, weekdays.
          </div>
          <Link href="/orders/new?kit=contractor-payment-kit" className="px-6 py-2.5 rounded-[10px] font-semibold text-[14px] flex-shrink-0" style={{ background: 'var(--em-orange)', color: 'white' }}>
            Buy the kit - $49 -&gt;
          </Link>
        </div>
      </section>
    </div>
  );
}
