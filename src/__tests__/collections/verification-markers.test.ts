import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { customerVerification, parseCustomerVerification, CV_MARKER_RE } from '@/lib/collections/templates/shared'

describe('customerVerification helper', () => {
  it('returns a structured marker round-trippable via parseCustomerVerification', () => {
    const marker = customerVerification({
      state: 'CO',
      statuteSection: 'C.R.S. § 38-22-109(3)',
      description: 'Verify the 10-day notice language.',
      packetSection: 'Step 2 — Notice of Intent to Lien',
    })
    expect(marker).toMatch(/^<<CV /)
    expect(marker).toMatch(/ CV>>$/)
    const parsed = parseCustomerVerification(marker)
    expect(parsed).toBeTruthy()
    expect(parsed!.state).toBe('CO')
    expect(parsed!.statuteSection).toBe('C.R.S. § 38-22-109(3)')
    expect(parsed!.description).toMatch(/10-day/)
    expect(parsed!.packetSection).toMatch(/Step 2/)
  })

  it('CV_MARKER_RE matches inside a body string', () => {
    const body = 'Before the line. ' + customerVerification({
      state: 'TX',
      statuteSection: 'Tex. Prop. Code § 53.054',
      description: 'Verify the affidavit opening.',
      packetSection: 'Step 3 — Lien Affidavit',
    }) + ' After the line.'
    const matches = body.match(CV_MARKER_RE)
    expect(matches).toHaveLength(1)
  })
})

function countMatches(file: string, re: RegExp): number {
  const src = readFileSync(file, 'utf8')
  return (src.match(re) ?? []).length
}

describe('customerVerification marker presence in templates', () => {
  it('each CO template makes ≥1 customerVerification call', () => {
    const dir = path.resolve(process.cwd(), 'src/lib/collections/templates/co')
    const files = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'instruction-packet.ts')
    for (const f of files) {
      const count = countMatches(path.join(dir, f), /customerVerification\(/g)
      expect(count, `${f} customerVerification calls`).toBeGreaterThanOrEqual(1)
    }
  })

  it('each TX template makes ≥1 customerVerification call', () => {
    const dir = path.resolve(process.cwd(), 'src/lib/collections/templates/tx')
    const files = readdirSync(dir).filter(f => f.endsWith('.ts'))
    for (const f of files) {
      if (f === 'instruction-packet.ts') continue   // doesn't use markers
      const count = countMatches(path.join(dir, f), /customerVerification\(/g)
      expect(count, `${f} customerVerification calls`).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('PDF generator: visible verification markers + NOT-READY banner', () => {
  it('pdf-generator source renders amber callout and NOT READY TO FILE banner', () => {
    const src = readFileSync(path.resolve(process.cwd(), 'src/lib/collections/pdf-generator.ts'), 'utf8')
    expect(src).toMatch(/CUSTOMER VERIFICATION REQUIRED/)
    expect(src).toMatch(/NOT READY TO FILE/)
    expect(src).toMatch(/COLOR_AMBER_BG/)
    expect(src).toMatch(/COLOR_AMBER_700/)
  })

  it('top-of-document banner draws on filing documents but not on the instruction packet', () => {
    const src = readFileSync(path.resolve(process.cwd(), 'src/lib/collections/pdf-generator.ts'), 'utf8')
    // The filing doc render path calls drawFilingBanner; the instruction packet does not.
    expect(src).toMatch(/drawFilingBanner\(page, sansBold\)/)
    // renderInstructionPacketPdf should NOT call drawFilingBanner
    const instBlock = src.split('renderInstructionPacketPdf')[1] ?? ''
    expect(instBlock).not.toMatch(/drawFilingBanner\(/)
  })
})
