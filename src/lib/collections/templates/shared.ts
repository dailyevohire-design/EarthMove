import { SHORT_DISCLAIMER, UPL_DISCLAIMER } from '../disclaimer'

export interface RenderedDocument {
  title: string
  body: string
  disclaimerHeader: string
  disclaimerFooter: string
}

export function headerBlock(): string {
  return `GENERATED DOCUMENT — NOT LEGAL ADVICE\n${SHORT_DISCLAIMER}`
}

export function footerBlock(): string {
  return UPL_DISCLAIMER
}

export function formatCurrency(cents: number | bigint): string {
  const n = typeof cents === 'bigint' ? Number(cents) : cents
  const dollars = n / 100
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

// Placeholders forcing counsel review on every uncertain statutory question.
// Rendered in bold red in the PDF output. Never replaced by fabricated text.
export function verifyAttorney(state: 'CO' | 'TX', description: string): string {
  const stateName = state === 'CO' ? 'COLORADO' : 'TEXAS'
  return `[VERIFY WITH ${stateName} ATTORNEY: ${description}]`
}

// Compose an address block (multi-line, safe for blank middle lines).
export function addressBlock(name: string, address: string): string {
  return `${name}\n${address}`
}
