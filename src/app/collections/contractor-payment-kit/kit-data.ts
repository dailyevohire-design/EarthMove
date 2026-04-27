// Contractor Payment Kit data. Static for v1 - no DB, no Stripe wiring yet.
// When Stripe price ID + digital_products table land (separate commit), the
// $49 CTA href becomes a server action that creates a Checkout Session.

export interface KitItem {
  id: string;
  title: string;
  body: string;
}

export interface KitFile {
  id: string;
  name: string;
  formats: string[];
  sizeKb: number;
  reviewedAt: string;
}

export interface TimelineStep {
  step: number;
  label: string;
  body: string;
}

export const WHAT_YOU_GET: KitItem[] = [
  {
    id: 'pre-lien',
    title: 'Pre-lien notice',
    body: 'A dated written notice you send to the property owner before any lien filing. Establishes the legal record that you provided labor or materials and intend to be paid. Required in Texas for protection. Strongly recommended in Colorado.',
  },
  {
    id: 'mechanics-lien',
    title: 'Mechanic\'s lien filing',
    body: 'The actual lien document filed with the county recorder. Encumbers the property title until the debt is paid, releases, or expires. Texas and Colorado statutory templates with the correct affidavit language and deadlines.',
  },
  {
    id: 'demand-letter',
    title: 'Demand letter',
    body: 'A formal written demand for payment, dated, with the amount owed, the work performed, and the lien filing referenced. Often resolves the dispute before court. Drafted to be sent before legal action without prejudicing later filings.',
  },
  {
    id: 'lien-release',
    title: 'Lien release',
    body: 'The document you file to release the lien once the debt is paid. Required to clear the property title. Includes partial-release variant for progress payments on multi-phase projects.',
  },
];

export const WHAT_YOU_DO: KitItem[] = [
  {
    id: 'fill-blanks',
    title: 'Fill the blanks',
    body: 'Each document has yellow-highlighted fields. Property address, owner name, your business name, dates, dollar amounts, lot/block from the deed. Plain English instructions per field. About 15 minutes per document the first time.',
  },
  {
    id: 'check-deadlines',
    title: 'Check the deadline calendar',
    body: 'Texas pre-lien is due by the 15th of the third month after work was performed. Colorado is the 15th of the second month. The included calendar tells you which document to send when, given the date you started work. Miss the deadline and the lien is waived.',
  },
  {
    id: 'send-and-record',
    title: 'Send and record',
    body: 'Pre-lien and demand go via certified mail with return receipt - keep the green card. Lien filings go to the county recorder where the property sits, with the recording fee in hand. The kit lists every Texas and Colorado county recorder office with address, phone, and current fee.',
  },
  {
    id: 'follow-the-clock',
    title: 'Follow the clock',
    body: 'Once the lien records, the owner has incentive to settle. Most disputes resolve here. If they do not, you have a fixed window to file suit before the lien expires - one year in Texas, six months in Colorado. The kit tells you exactly when that window opens and closes.',
  },
];

export const TIMELINE: TimelineStep[] = [
  {
    step: 1,
    label: 'Pre-lien notice sent',
    body: 'Day 0 to 75 depending on state. Certified mail to owner. The clock starts when work was performed, not when invoice was sent.',
  },
  {
    step: 2,
    label: 'Owner calls the GC',
    body: 'In most cases the GC calls the owner before things escalate. Document every conversation. The kit includes a call log template.',
  },
  {
    step: 3,
    label: 'Lien recorded',
    body: 'You file the mechanic\'s lien at the county recorder. The property title is encumbered. Title companies see it. Refinancing is blocked. Most disputes settle within 30 days of recording.',
  },
  {
    step: 4,
    label: 'Release filed',
    body: 'Payment received. You file the lien release within 10 days (Texas statutory) or 7 days (Colorado statutory). The title clears. Document everything for your records.',
  },
];

export const KIT_FILES: KitFile[] = [
  { id: 'pre-lien-tx',     name: 'Pre-lien notice - Texas',          formats: ['.docx', '.pdf'], sizeKb: 142, reviewedAt: 'Apr 2026' },
  { id: 'pre-lien-co',     name: 'Pre-lien notice - Colorado',       formats: ['.docx', '.pdf'], sizeKb: 138, reviewedAt: 'Apr 2026' },
  { id: 'lien-tx',         name: 'Mechanic\'s lien - Texas',         formats: ['.docx', '.pdf'], sizeKb: 186, reviewedAt: 'Apr 2026' },
  { id: 'lien-co',         name: 'Mechanic\'s lien - Colorado',      formats: ['.docx', '.pdf'], sizeKb: 174, reviewedAt: 'Apr 2026' },
  { id: 'demand',          name: 'Demand letter',                    formats: ['.docx', '.pdf'], sizeKb: 96,  reviewedAt: 'Apr 2026' },
  { id: 'release-tx',      name: 'Lien release - Texas',             formats: ['.docx', '.pdf'], sizeKb: 88,  reviewedAt: 'Apr 2026' },
  { id: 'release-co',      name: 'Lien release - Colorado',          formats: ['.docx', '.pdf'], sizeKb: 84,  reviewedAt: 'Apr 2026' },
  { id: 'calendar',        name: 'Deadline calendar - both states',  formats: ['.pdf'],          sizeKb: 122, reviewedAt: 'Apr 2026' },
];

export const KIT_VERSION = 'v3.2 - Apr 2026';
