import type { CollectionsCase } from '../../types'
import { loadInstructionContent } from '../../content/loader'
import { renderInstructionPacketPdf } from '../../pdf-generator'
import { formatCurrency, formatDate } from '../shared'

export async function renderCOInstructionPacket(c: CollectionsCase): Promise<Uint8Array> {
  const sections = await loadInstructionContent('CO')

  // Deadline arithmetic (C.R.S. § 38-22-109(5) — 4 months from last day of work).
  const last = new Date(c.last_day_of_work + 'T00:00:00Z')
  const deadline = new Date(last); deadline.setUTCMonth(deadline.getUTCMonth() + 4)
  const daysLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 86400000))

  const caseSummary = [
    `Claimant: ${c.claimant_name}`,
    `Case ID: ${c.id.slice(0, 8)}`,
    `Property: ${c.property_street_address}, ${c.property_city}, CO ${c.property_zip}`,
    `County: ${c.property_county}`,
    `Amount owed: ${formatCurrency(c.amount_owed_cents)}`,
    `First day of work: ${formatDate(c.first_day_of_work)}`,
    `Last day of work: ${formatDate(c.last_day_of_work)}`,
    `C.R.S. § 38-22-109(5) 4-month filing deadline: ${formatDate(deadline)} (${daysLeft} days remaining)`,
  ]

  return renderInstructionPacketPdf({
    title: 'Contractor Payment Kit — Colorado',
    sections,
    kitVariant: c.kit_variant,
    stateLabel: 'Colorado',
    caseSummary,
  })
}
