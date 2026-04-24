import { readFile } from 'fs/promises'
import path from 'path'
import type { CollectionsCase } from '../../types'
import { loadInstructionContent } from '../../content/loader'
import { renderInstructionPacketPdf, type InstructionSection } from '../../pdf-generator'
import { formatCurrency, formatDate } from '../shared'

export async function renderTXInstructionPacket(c: CollectionsCase): Promise<Uint8Array> {
  let sections = await loadInstructionContent('TX')

  // Conditionally prepend Section 0 — Why Your Case Does Not Support A Lien,
  // loaded from content/tx/00a-why-no-lien-homestead.md.
  // Loader already returns 00a in the ordered list when present; for the
  // full_kit variant we skip it so the customer is not shown an explanation
  // that does not apply.
  if (c.kit_variant !== 'demand_only' || !c.is_homestead) {
    sections = sections.filter(s => s.slug !== '00a-why-no-lien-homestead')
  }

  // If we need Section 0 but the loader didn't pick it up (missing file), try a
  // direct read — avoids a silent drop in the demand_only path.
  if (c.kit_variant === 'demand_only' && c.is_homestead &&
      !sections.some(s => s.slug === '00a-why-no-lien-homestead')) {
    try {
      const raw = await readFile(
        path.resolve(process.cwd(), 'src/lib/collections/content/tx/00a-why-no-lien-homestead.md'),
        'utf8',
      )
      const h1 = /^#\s+(.+?)\s*$/m.exec(raw)
      const title = h1 ? h1[1].trim() : 'Why Your Case Does Not Support A Lien'
      const bodyMarkdown = h1 ? raw.replace(h1[0], '').trim() : raw.trim()
      const extra: InstructionSection = { slug: '00a-why-no-lien-homestead', title, bodyMarkdown }
      // Insert after 00-welcome (if present), else at the top.
      const welcomeIdx = sections.findIndex(s => s.slug.startsWith('00-'))
      const pos = welcomeIdx >= 0 ? welcomeIdx + 1 : 0
      sections = [...sections.slice(0, pos), extra, ...sections.slice(pos)]
    } catch { /* if file genuinely missing we continue without */ }
  }

  const last = new Date(c.last_day_of_work + 'T00:00:00Z')
  // TX filing deadline varies by tier. For the generic header we show a
  // conservative 4-month reference and defer detail to Step 1 of the packet.
  const fourMonthsOut = new Date(last); fourMonthsOut.setUTCMonth(fourMonthsOut.getUTCMonth() + 4)
  const daysLeft = Math.max(0, Math.round((fourMonthsOut.getTime() - Date.now()) / 86400000))

  const caseSummary = [
    `Claimant: ${c.claimant_name}`,
    `Case ID: ${c.id.slice(0, 8)}`,
    `Property: ${c.property_street_address}, ${c.property_city}, TX ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Homestead: ${c.is_homestead ? 'Yes' : 'No'}  ·  Kit variant: ${c.kit_variant}`,
    `Amount owed: ${formatCurrency(c.amount_owed_cents)}`,
    `Last day of work: ${formatDate(c.last_day_of_work)}`,
    `Generic 4-month reference: ${formatDate(fourMonthsOut)} (${daysLeft} days) — actual tier-specific deadline in Step 1.`,
  ]

  return renderInstructionPacketPdf({
    title: 'Contractor Payment Kit — Texas',
    sections,
    kitVariant: c.kit_variant,
    stateLabel: 'Texas',
    caseSummary,
  })
}
