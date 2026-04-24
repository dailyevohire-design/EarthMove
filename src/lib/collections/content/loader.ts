import { readdir, readFile } from 'fs/promises'
import path from 'path'
import type { InstructionSection } from '../pdf-generator'

// Reads numbered markdown files from content/{state}/ and returns them sorted by
// filename prefix. Each file may start with an ATX heading (# Title) which is
// extracted as the section title; if missing, the filename (sans prefix) is used.
export async function loadInstructionContent(
  state: 'CO' | 'TX',
): Promise<InstructionSection[]> {
  const dir = path.resolve(process.cwd(), 'src/lib/collections/content', state.toLowerCase())
  const files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort()

  const sections: InstructionSection[] = []
  for (const file of files) {
    const full = path.join(dir, file)
    const raw = await readFile(full, 'utf8')

    // Strip leading H1 as title, if present.
    const h1 = /^#\s+(.+?)\s*$/m.exec(raw)
    const slug = file.replace(/\.md$/, '')
    const title = h1 ? h1[1].trim() : slug.replace(/^\d+[a-z]?-/, '').replace(/-/g, ' ')
    const bodyMarkdown = h1 ? raw.replace(h1[0], '').trim() : raw.trim()

    sections.push({ slug, title, bodyMarkdown })
  }
  return sections
}
