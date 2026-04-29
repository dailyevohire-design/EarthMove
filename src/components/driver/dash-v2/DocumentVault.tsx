const FRAUNCES = "'Fraunces', serif"
const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

// Hardcoded per artboard. Followup #37: wire to driver_documents table
// when migration ships in T2 (~migration 028). Sort key: action-required
// first, then expiring within 30d, then on-file.
type Status =
  | { kind: 'action-required'; label: string }
  | { kind: 'expiring-soon'; label: string }
  | { kind: 'on-file'; label: string }
  | { kind: 'on-file-perpetual'; label: string }

type DocCard = {
  name: string
  desc: string
  status: Status
  uploadedLabel: string
  size: string
}

const DOCS: DocCard[] = [
  {
    name: 'COI · General Liability',
    desc: 'Required by EarthMove for all drivers; certificate of insurance proving GL coverage.',
    status: { kind: 'action-required', label: 'Action required · upload now' },
    uploadedLabel: 'No file on record',
    size: '—',
  },
  {
    name: 'DOT Medical Card',
    desc: 'CDL medical examiner certificate. Required to operate a CMV.',
    status: { kind: 'expiring-soon', label: 'Expires in 23 days' },
    uploadedLabel: 'Uploaded Oct 18, 2024',
    size: '0.9 MB',
  },
  {
    name: 'W-9',
    desc: 'IRS form for 1099 reporting; on file for the life of your account.',
    status: { kind: 'on-file-perpetual', label: 'On file' },
    uploadedLabel: 'Uploaded Mar 14, 2025',
    size: '0.4 MB',
  },
  {
    name: 'COI · Auto Liability',
    desc: 'Auto liability coverage for the truck.',
    status: { kind: 'on-file', label: 'On file · expires Mar 14, 2027' },
    uploadedLabel: 'Uploaded Mar 14, 2025',
    size: '2.1 MB',
  },
  {
    name: 'CDL (front + back)',
    desc: 'Class A commercial driver license. Number not stored — status only.',
    status: { kind: 'on-file', label: 'On file · expires Dec 02, 2028' },
    uploadedLabel: 'Uploaded Mar 14, 2025',
    size: '1.6 MB',
  },
  {
    name: 'Truck Registration',
    desc: 'Texas vehicle registration for the dump truck.',
    status: { kind: 'on-file', label: 'On file · expires Jan 31, 2027' },
    uploadedLabel: 'Uploaded Feb 03, 2025',
    size: '0.3 MB',
  },
  {
    name: 'DOT Annual Inspection',
    desc: 'Federally required annual vehicle inspection report.',
    status: { kind: 'on-file', label: 'On file · expires Aug 09, 2026' },
    uploadedLabel: 'Uploaded Aug 11, 2025',
    size: '1.1 MB',
  },
]

export function DocumentVault() {
  return (
    <section className="mt-9">
      <div className="flex justify-between items-end gap-3.5 mb-3.5">
        <div className="flex flex-col gap-2">
          <span
            className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2A332E]"
            style={{ fontFamily: SANS }}
          >
            <span aria-hidden className="inline-block w-[18px] h-[1.5px] bg-[#2A332E]" />
            Documents on file
          </span>
          <h2
            className="text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-[-0.02em] leading-[1.1] text-[#15201B] m-0"
            style={{ fontFamily: FRAUNCES }}
          >
            Your <em className="italic font-medium">paperwork</em>, in one place.
          </h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold text-[14px] px-[18px] py-3 bg-[#E5701B] text-white border border-transparent hover:bg-[#C95F12] transition-colors"
          style={{ fontFamily: SANS }}
        >
          Upload document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[18px]">
        {DOCS.map((doc) => (
          <DocCardEl key={doc.name} doc={doc} />
        ))}
        <AddDocTile />
      </div>
    </section>
  )
}

function DocCardEl({ doc }: { doc: DocCard }) {
  return (
    <article
      className="bg-white rounded-[14px] p-[18px] flex flex-col gap-2.5"
      style={{ border: '1px solid #D8D2C4' }}
    >
      <StatusLozenge status={doc.status} />
      <h4
        className="text-[18px] font-semibold tracking-[-0.015em] leading-[1.15] text-[#15201B] m-0"
        style={{ fontFamily: FRAUNCES }}
      >
        {doc.name}
      </h4>
      <p className="text-[13px] text-[#5C645F] leading-[1.5] m-0">{doc.desc}</p>
      <div
        className="text-[10px] uppercase tracking-[0.06em] text-[#5C645F] mt-auto pt-2.5"
        style={{ fontFamily: MONO, borderTop: '1px solid #D8D2C4' }}
      >
        {doc.uploadedLabel} · {doc.size}
      </div>
      <div className="flex gap-3 text-[11px] text-[#2A332E]" style={{ fontFamily: MONO }}>
        <a href="#replace" className="hover:text-[#E5701B]">Replace</a>
        <span aria-hidden className="text-[#5C645F]">·</span>
        <a href="#download" className="hover:text-[#E5701B]">Download</a>
        <span aria-hidden className="text-[#5C645F]">·</span>
        <a href="#remove" className="hover:text-[#E5701B]">Remove</a>
      </div>
    </article>
  )
}

function StatusLozenge({ status }: { status: Status }) {
  const palette =
    status.kind === 'action-required'
      ? 'bg-[#E5701B] text-white border-transparent'
      : status.kind === 'expiring-soon'
      ? 'bg-[#E0A52A] text-[#15201B] border-transparent'
      : status.kind === 'on-file'
      ? 'bg-[#1F8A5C] text-white border-transparent'
      : 'bg-white text-[#15201B] border-[#D8D2C4]'
  return (
    <span
      className={`inline-flex self-start items-center text-[10px] font-semibold uppercase tracking-[0.08em] border rounded-[5px] px-2.5 py-1 whitespace-nowrap ${palette}`}
      style={{ fontFamily: MONO }}
    >
      {status.label}
    </span>
  )
}

function AddDocTile() {
  return (
    <button
      type="button"
      className="rounded-[14px] p-[18px] flex flex-col items-center justify-center gap-1.5 text-center min-h-[180px] hover:border-[#5C645F] transition-colors"
      style={{ background: 'transparent', border: '2px dashed #D8D2C4' }}
    >
      <span className="text-[14px] text-[#5C645F]" style={{ fontFamily: SANS }}>
        + Add another document
      </span>
      <span className="text-[10px] uppercase tracking-[0.06em] text-[#5C645F]" style={{ fontFamily: MONO }}>
        (Drug screen, IFTA, IRP, etc.)
      </span>
    </button>
  )
}
