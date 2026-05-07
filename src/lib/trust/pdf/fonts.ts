/**
 * Font registration for @react-pdf/renderer. Base64-embedded TTF from
 * src/lib/trust/pdf/fonts/ (committed binaries). Embedding rather than
 * fetching ensures the renderer works in any environment — serverless
 * functions, build-time scripts, local dev — with zero runtime network
 * dependency.
 *
 * Format note: TTF specifically (NOT woff2) because @react-pdf/renderer's
 * underlying fontkit subsetter has known compatibility issues with current
 * woff2 builds of these families that surface as
 * "RangeError: Offset is outside the bounds of the DataView" during embed.
 * TTF embeds cleanly. Source files were pulled from fonts.gstatic.com via
 * the Google Fonts CSS API (no User-Agent — that path returns TTF format
 * by default; UA-aware path returns woff2).
 *
 * Module-level execution: Font.register fires on first registerPdfFonts()
 * call. Idempotent — repeated imports across modules are safe.
 */

import { Font } from '@react-pdf/renderer'
import fs from 'node:fs'
import path from 'node:path'

const FONT_DIR = path.join(process.cwd(), 'src/lib/trust/pdf/fonts')

function dataUri(filename: string): string {
  const buf = fs.readFileSync(path.join(FONT_DIR, filename))
  return `data:font/ttf;base64,${buf.toString('base64')}`
}

let _registered = false

export function registerPdfFonts(): void {
  if (_registered) return
  _registered = true

  Font.register({
    family: 'Inter',
    fonts: [
      { src: dataUri('inter-400.ttf'), fontWeight: 400 },
      { src: dataUri('inter-500.ttf'), fontWeight: 500 },
      { src: dataUri('inter-600.ttf'), fontWeight: 600 },
      { src: dataUri('inter-700.ttf'), fontWeight: 700 },
    ],
  })

  Font.register({
    family: 'Fraunces',
    fonts: [
      { src: dataUri('fraunces-500.ttf'), fontWeight: 500 },
      { src: dataUri('fraunces-600.ttf'), fontWeight: 600 },
    ],
  })

  Font.register({
    family: 'JetBrainsMono',
    fonts: [
      { src: dataUri('jetbrains-mono-500.ttf'), fontWeight: 500 },
    ],
  })

  // react-pdf's hyphenation defaults break across-word at lowercase letters
  // for any text without explicit soft-hyphens. Disable so contractor names
  // and addresses don't render with bizarre mid-word hyphens.
  Font.registerHyphenationCallback((word) => [word])
}
