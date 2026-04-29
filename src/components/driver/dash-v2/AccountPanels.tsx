const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// All four panels (BusinessEntity, TruckEquipment, PaymentMethod,
// DispatchPreferences) live inline here per spec — keeps the file count
// manageable. Hardcoded per artboard.

export function AccountPanels() {
  return (
    <div className="mt-9 flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <BusinessEntity />
        <TruckEquipment />
      </div>
      <PaymentMethod />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <DispatchPreferences />
        <BlackoutDates />
      </div>
    </div>
  )
}

function PanelCard({
  eyebrow,
  title,
  children,
  bg = 'white',
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
  bg?: 'white' | 'paper-2'
}) {
  return (
    <section
      className="rounded-[18px] p-6"
      style={{ background: bg === 'white' ? '#FFFFFF' : '#E9E3D5', border: '1px solid #D8D2C4' }}
    >
      <span
        className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.10em] text-[#2A332E]"
        style={{ fontFamily: MONO }}
      >
        <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
        {eyebrow}
      </span>
      <h4
        className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.015em] leading-[1.15] text-[#15201B] mt-3 mb-4"
        style={{ fontFamily: FRAUNCES }}
      >
        {title}
      </h4>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2"
      style={{ borderTop: '1px solid #D8D2C4' }}
    >
      <span className="text-[14px] text-[#2A332E]" style={{ fontFamily: SANS }}>{label}</span>
      <span className="text-[13px] text-[#15201B] font-semibold" style={{ fontFamily: MONO }}>{value}</span>
    </div>
  )
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[12px] px-3.5 py-2 bg-transparent text-[#15201B] border border-[#15201B] hover:bg-[#15201B] hover:text-[#F1ECE2] transition-colors"
      style={{ fontFamily: SANS }}
    >
      {children}
    </button>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex text-[11px] text-[#15201B] font-semibold rounded-[6px] px-2.5 py-1.5"
      style={{ background: '#FFFFFF', border: '1px solid #D8D2C4', fontFamily: MONO }}
    >
      {children}
    </span>
  )
}

/* ---- Panels ---- */

function BusinessEntity() {
  return (
    <PanelCard eyebrow="Business entity" title="Marco Delgado Hauling LLC">
      <div className="flex flex-col">
        <Row label="EIN" value="••–•••1842" />
        <Row label="DOT number" value="3,748,221" />
        <Row label="MC number" value="MC-12,991" />
        <Row label="TX entity status" value="Active (verified Apr 18)" />
        <Row label="Registered agent" value="On file" />
        <Row label="Formed" value="March 2021" />
      </div>
      <div className="flex justify-end mt-4">
        <GhostBtn>Edit</GhostBtn>
      </div>
    </PanelCard>
  )
}

function TruckEquipment() {
  return (
    <PanelCard eyebrow="Truck & equipment" title="2019 Mack Granite GU713">
      <div className="flex flex-col">
        <Row label="Class" value="Tri-axle dump" />
        <Row label="Plate" value="TX 8C-3 4471" />
        <Row label="VIN" value="Last 6: ••••••H82914" />
        <Row label="Capacity" value="14 tons / 12 cubic yards" />
        <Row label="Body" value="Williamsen 12-yd steel" />
        <Row label="Last service" value="Apr 02, 2026 (8,400 mi)" />
      </div>
      <div className="flex justify-end mt-4">
        <GhostBtn>Edit</GhostBtn>
      </div>
    </PanelCard>
  )
}

function PaymentMethod() {
  return (
    <PanelCard eyebrow="Settlement method" title="ACH to Chase ••2218">
      <div className="flex flex-col gap-1">
        <p className="text-[14px] text-[#2A332E] m-0">
          Routing on file · Last settlement Apr 18 · Next settlement Apr 30
        </p>
        <div className="flex flex-wrap gap-3 items-center mt-4">
          <GhostBtn>Switch to direct deposit via Stripe</GhostBtn>
          <a
            href="#add-backup"
            className="text-[11px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#E5701B] font-semibold"
            style={{ fontFamily: MONO }}
          >
            Add a backup method →
          </a>
        </div>
      </div>
    </PanelCard>
  )
}

function DispatchPreferences() {
  return (
    <PanelCard eyebrow="Dispatch preferences" title="What you'll be offered.">
      <div className="flex flex-col">
        <PrefRow label="Max distance from home yard" value={<Chip>35 mi</Chip>} />
        <PrefRow
          label="Truck classes you run"
          value={
            <span className="flex gap-1.5 flex-wrap justify-end">
              <Chip>TRI-AXLE</Chip>
              <Chip>TANDEM</Chip>
            </span>
          }
        />
        <PrefRow label="Materials you'll haul" value={<Chip>ALL</Chip>} />
        <PrefRow label="Earliest pickup" value={<Chip>06:00</Chip>} />
        <PrefRow label="Latest dispatch acceptance" value={<Chip>16:30</Chip>} />
      </div>
      <a
        href="#edit-prefs"
        className="text-[11px] uppercase tracking-[0.06em] text-[#5C645F] hover:text-[#E5701B] font-semibold mt-4 inline-block"
        style={{ fontFamily: MONO }}
      >
        Edit preferences →
      </a>
    </PanelCard>
  )
}

function PrefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2.5"
      style={{ borderTop: '1px solid #D8D2C4' }}
    >
      <span className="text-[14px] text-[#2A332E]" style={{ fontFamily: SANS }}>{label}</span>
      {value}
    </div>
  )
}

function BlackoutDates() {
  return (
    <PanelCard eyebrow="Blackout dates" title="Days you're not dispatchable." bg="paper-2">
      <div className="flex flex-wrap gap-2 mt-1">
        <Chip>May 12-13</Chip>
        <Chip>May 27</Chip>
        <Chip>Jun 04</Chip>
      </div>
      <div className="mt-4">
        <GhostBtn>Add a blackout day</GhostBtn>
      </div>
      <p className="text-[11px] text-[#5C645F] mt-3 m-0" style={{ fontFamily: MONO }}>
        We won&apos;t show you loads on these dates.
      </p>
    </PanelCard>
  )
}
