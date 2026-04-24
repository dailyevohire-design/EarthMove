import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { UPL_DISCLAIMER, SHORT_DISCLAIMER } from '@/lib/collections/disclaimer'

describe('UPL_DISCLAIMER content', () => {
  it('contains the required regulatory + liability phrases', () => {
    expect(UPL_DISCLAIMER).toMatch(/not a law firm/i)
    expect(UPL_DISCLAIMER).toMatch(/licensed in the state where the property is located/i)
    expect(UPL_DISCLAIMER).toContain('C.R.S. § 38-22-128')
    expect(UPL_DISCLAIMER).toContain('Tex. Prop. Code § 53.156')
    expect(UPL_DISCLAIMER).toMatch(/slander of title/i)
  })

  it('short disclaimer names Earth Pro Connect LLC and the attorney requirement', () => {
    expect(SHORT_DISCLAIMER).toMatch(/Earth Pro Connect LLC/)
    expect(SHORT_DISCLAIMER).toMatch(/attorney/i)
  })
})

describe('docs/LEGAL_POSTURE.md case citations', () => {
  const md = readFileSync(path.resolve(process.cwd(), 'docs/LEGAL_POSTURE.md'), 'utf8')
  it('cites Medlock, Nolo Press (or Parsons Technology), and Janson', () => {
    expect(md).toMatch(/Medlock/)
    expect(md).toMatch(/Nolo Press|Parsons Technology/)
    expect(md).toMatch(/Janson/)
  })
})
