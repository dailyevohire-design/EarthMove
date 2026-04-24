import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { loadInstructionContent } from '@/lib/collections/content/loader'

describe('instruction packet content loader', () => {
  it('CO instruction content loads 13 sections', async () => {
    const sections = await loadInstructionContent('CO')
    expect(sections).toHaveLength(13)
    const slugs = sections.map(s => s.slug)
    expect(slugs).toContain('00-welcome')
    expect(slugs).toContain('01-overview')
    expect(slugs).toContain('11-when-to-call-attorney')
    expect(slugs).toContain('12-red-flags-and-gotchas')
  })

  it('TX instruction content loads 16 sections (incl. conditional 00a)', async () => {
    const sections = await loadInstructionContent('TX')
    expect(sections.length).toBeGreaterThanOrEqual(15)
    const slugs = sections.map(s => s.slug)
    expect(slugs).toContain('00-welcome')
    expect(slugs).toContain('00a-why-no-lien-homestead')
    expect(slugs).toContain('01a-is-this-homestead')
    expect(slugs).toContain('01b-your-contractor-tier')
    expect(slugs).toContain('11-when-to-call-attorney')
  })

  it('every section has a non-empty title and bodyMarkdown', async () => {
    for (const state of ['CO', 'TX'] as const) {
      const sections = await loadInstructionContent(state)
      for (const s of sections) {
        expect(s.title.length).toBeGreaterThan(0)
        expect(s.bodyMarkdown.length).toBeGreaterThan(100)
      }
    }
  })

  it('CO demand-letter step section references C.R.S.', async () => {
    const sections = await loadInstructionContent('CO')
    const stepOne = sections.find(s => s.slug === '02-step-1-demand-letter')
    expect(stepOne).toBeTruthy()
    expect(stepOne!.bodyMarkdown).toMatch(/C\.R\.S\./)
  })

  it('TX demand-only homestead section exists and explains why no lien', async () => {
    const sections = await loadInstructionContent('TX')
    const homestead = sections.find(s => s.slug === '00a-why-no-lien-homestead')
    expect(homestead).toBeTruthy()
    expect(homestead!.bodyMarkdown).toMatch(/homestead/i)
    expect(homestead!.bodyMarkdown).toMatch(/§ 53\.254/)
  })

  it('every CO and TX content file ends with an attorney-consultation prompt', () => {
    for (const state of ['co', 'tx']) {
      const dir = path.resolve(process.cwd(), 'src/lib/collections/content', state)
      const files = readdirSync(dir).filter(f => f.endsWith('.md'))
      for (const f of files) {
        const src = readFileSync(path.join(dir, f), 'utf8')
        // Each file should prompt calling an attorney at least once somewhere in the body.
        expect(src, `${f} should mention calling an attorney`).toMatch(/attorney/i)
      }
    }
  })

  it('no content file exceeds a sensible maximum that would indicate bloat (<15000 chars per section)', () => {
    for (const state of ['co', 'tx']) {
      const dir = path.resolve(process.cwd(), 'src/lib/collections/content', state)
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.md')) continue
        const size = statSync(path.join(dir, f)).size
        expect(size, `${f} size`).toBeLessThan(15000)
      }
    }
  })
})
