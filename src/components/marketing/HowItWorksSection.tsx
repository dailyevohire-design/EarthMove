const STEPS = [
  { n: '01', title: 'Order',    body: 'Enter your ZIP. Delivered prices for your market in seconds.',                              meta: 'ZIP RESOLVED · ~3 SEC' },
  { n: '02', title: 'Match',    body: 'Routed to the nearest verified yard. Cheapest delivered cost wins.',                        meta: '13 YARDS · DEN + DFW' },
  { n: '03', title: 'Dispatch', body: 'A driver accepts. Live ETA the moment the truck loads at the scale.',                       meta: 'GPS-TRACKED · PHOTO ON DROP' },
  { n: '04', title: 'Delivery', body: 'Truck arrives in your window. Photo-confirmed drop. BOL + ticket on your invoice.',         meta: 'PAY ON DELIVERY · NET-30 · CARD' },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-heading"
      className="bg-[#F5F1E8] py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex items-center gap-3">
          <span className="h-px w-8 bg-[#1F3D2E]/40" aria-hidden="true" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1F3D2E]/70">
            How it works
          </span>
        </div>
        <h2
          id="hiw-heading"
          className="font-serif text-4xl font-medium leading-[1.05] tracking-tight text-[#1F3D2E] md:text-6xl"
        >
          ZIP entered to dirt <em className="italic font-normal">moved.</em>
        </h2>
        <ol className="mt-12 border-t border-[#1F3D2E]/15 md:mt-16">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="grid grid-cols-12 items-baseline gap-x-6 gap-y-2 border-b border-[#1F3D2E]/15 py-7 md:gap-x-8 md:py-9"
            >
              <span className="col-span-2 font-mono text-sm tracking-wider text-[#1F3D2E] md:col-span-1">
                {s.n}
              </span>
              <h3 className="col-span-10 font-serif text-2xl font-medium text-[#1F3D2E] md:col-span-3 md:text-3xl">
                {s.title}
              </h3>
              <p className="col-span-12 text-base leading-relaxed text-[#1F3D2E]/75 md:col-span-5 md:text-[17px]">
                {s.body}
              </p>
              <span className="col-span-12 font-mono text-[11px] uppercase tracking-[0.16em] text-[#1F3D2E]/60 md:col-span-3 md:text-right">
                {s.meta}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
