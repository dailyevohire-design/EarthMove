import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { CollectionsCase } from './types'
import { renderCODemandLetter }    from './templates/co/demand-letter'
import { renderCOMechanicsLien }   from './templates/co/mechanics-lien'
import { renderCONoticeOfIntent }  from './templates/co/notice-of-intent'
import { renderTXDemandLetter }    from './templates/tx/demand-letter'
import { renderTXLienAffidavit }   from './templates/tx/lien-affidavit'
import { renderTXPreLienNotice }   from './templates/tx/pre-lien-notice'
import type { RenderedDocument } from './templates/shared'

export interface GeneratedCasePDFs {
  demand_letter: Uint8Array
  doc2: Uint8Array
  lien: Uint8Array
  doc2_name: 'notice_of_intent' | 'pre_lien_notice'
}

// US Letter in points (72 pt/inch)
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 72           // 1-inch
const FOOTER_HEIGHT = 54    // reserved for footer disclaimer + page number
const HEADER_HEIGHT = 40    // reserved for "GENERATED DOCUMENT" header
const CONTENT_W = PAGE_W - 2 * MARGIN

const BODY_SIZE = 11
const HEADING_SIZE = 13
const HEADER_SIZE = 9
const SHORT_DISCLAIMER_SIZE = 8
const FOOTER_SIZE = 7

const COLOR_BLACK = rgb(0, 0, 0)
const COLOR_STONE = rgb(0.44, 0.44, 0.44)   // stone-600 approx
const COLOR_VERIFY = rgb(200 / 255, 50 / 255, 50 / 255)

const VERIFY_RE = /\[VERIFY WITH (COLORADO|TEXAS) ATTORNEY:[^\]]*\]/g

async function renderToPdf(doc: RenderedDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title)
  pdf.setProducer('Earth Pro Connect LLC — Collections Assist')
  pdf.setCreator('Earth Pro Connect LLC — Collections Assist')

  const font     = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const sans     = await pdf.embedFont(StandardFonts.Helvetica)

  // --- Footer + header drawing helpers, bound to a page ---
  const drawChrome = (page: PDFPage, pageNum: number, pageTotal: number) => {
    // Header
    page.drawText('GENERATED DOCUMENT — NOT LEGAL ADVICE', {
      x: MARGIN, y: PAGE_H - MARGIN + 16,
      size: HEADER_SIZE, font: sans, color: COLOR_STONE,
    })
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - MARGIN + 8 },
      end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN + 8 },
      thickness: 0.5, color: COLOR_STONE,
    })
    // Short disclaimer line
    page.drawText(
      'Earth Pro Connect LLC is not a law firm. Consult an attorney licensed in the property state before filing.',
      { x: MARGIN, y: PAGE_H - MARGIN - 4, size: SHORT_DISCLAIMER_SIZE, font: sans, color: COLOR_STONE },
    )

    // Footer: wrap UPL_DISCLAIMER at FOOTER_SIZE
    const footerText = doc.disclaimerFooter
    const footerLines = wrap(footerText, sans, FOOTER_SIZE, CONTENT_W)
    let fy = FOOTER_HEIGHT - 8
    for (const line of footerLines.slice(0, 5)) {
      page.drawText(line, { x: MARGIN, y: fy, size: FOOTER_SIZE, font: sans, color: COLOR_STONE })
      fy -= FOOTER_SIZE + 1
    }
    page.drawText(`Page ${pageNum} of ${pageTotal}`, {
      x: PAGE_W - MARGIN - 60, y: 20, size: FOOTER_SIZE, font: sans, color: COLOR_STONE,
    })
  }

  // --- Body layout ---
  const topY = PAGE_H - MARGIN - HEADER_HEIGHT + 20
  const bottomY = MARGIN + FOOTER_HEIGHT

  type Segment = { text: string; color: typeof COLOR_BLACK; font: PDFFont; size: number }

  const bodyLines = doc.body.split('\n')
  // Page 1 starts with a bold title
  const pages: PDFPage[] = []
  let page = pdf.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = topY

  // Title
  const titleSegs: Segment[] = [{ text: doc.title.toUpperCase(), color: COLOR_BLACK, font: fontBold, size: HEADING_SIZE }]
  y = drawWrappedRich(page, titleSegs, MARGIN, y, CONTENT_W, HEADING_SIZE + 4)
  y -= 6

  const bodyLineHeight = BODY_SIZE + 4

  for (const raw of bodyLines) {
    if (raw === '') {
      y -= bodyLineHeight * 0.6
      continue
    }
    // Split the line into plain + [VERIFY ...] red segments
    const segments: Segment[] = []
    let lastIdx = 0
    for (const match of raw.matchAll(VERIFY_RE)) {
      const idx = match.index ?? 0
      if (idx > lastIdx) {
        segments.push({ text: raw.slice(lastIdx, idx), color: COLOR_BLACK, font, size: BODY_SIZE })
      }
      segments.push({ text: match[0], color: COLOR_VERIFY, font: fontBold, size: BODY_SIZE })
      lastIdx = idx + match[0].length
    }
    if (lastIdx < raw.length) {
      segments.push({ text: raw.slice(lastIdx), color: COLOR_BLACK, font, size: BODY_SIZE })
    }
    if (segments.length === 0) {
      segments.push({ text: raw, color: COLOR_BLACK, font, size: BODY_SIZE })
    }

    // Need space? add page
    if (y < bottomY + bodyLineHeight) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = topY
    }

    y = drawWrappedRich(page, segments, MARGIN, y, CONTENT_W, bodyLineHeight)

    // If drawWrappedRich pushed past bottom, add overflow
    while (y < bottomY) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = topY
      // segments were already fully drawn in previous page if wrap returned smaller;
      // because drawWrappedRich does naive in-page wrap only, guard here is defensive.
    }
  }

  // Draw chrome on all pages with final totals
  const total = pages.length
  pages.forEach((p, i) => drawChrome(p, i + 1, total))

  return await pdf.save()
}

// --- Layout primitives ---

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      // Handle word longer than maxWidth by hard-cut
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = ''
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk); chunk = ch
          } else {
            chunk += ch
          }
        }
        line = chunk
      } else {
        line = w
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

// Draw a line composed of multiple styled segments, wrapping at word boundaries.
// Returns the y-cursor after drawing.
function drawWrappedRich(
  page: PDFPage,
  segments: { text: string; color: ReturnType<typeof rgb>; font: PDFFont; size: number }[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  // Build a flat list of styled words (space-separated preserves inter-word gaps).
  type Word = { text: string; color: ReturnType<typeof rgb>; font: PDFFont; size: number }
  const words: Word[] = []
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/).filter(s => s.length > 0)
    for (const p of parts) {
      words.push({ text: p, color: seg.color, font: seg.font, size: seg.size })
    }
  }

  let cursorX = x
  let cursorY = y
  for (const w of words) {
    const ww = w.font.widthOfTextAtSize(w.text, w.size)
    const isSpace = /^\s+$/.test(w.text)
    if (cursorX - x + ww > maxWidth && !isSpace) {
      cursorX = x
      cursorY -= lineHeight
    }
    if (!isSpace || cursorX !== x) {
      page.drawText(w.text, { x: cursorX, y: cursorY, size: w.size, font: w.font, color: w.color })
      cursorX += ww
    }
  }
  cursorY -= lineHeight
  return cursorY
}

// --- Entry point ---

export async function generateCasePDFs(c: CollectionsCase): Promise<GeneratedCasePDFs> {
  if (c.state_code === 'CO') {
    const demand = renderCODemandLetter(c)
    const notice = renderCONoticeOfIntent(c)
    const lien   = renderCOMechanicsLien(c)
    return {
      demand_letter: await renderToPdf(demand),
      doc2:          await renderToPdf(notice),
      lien:          await renderToPdf(lien),
      doc2_name:     'notice_of_intent',
    }
  }
  if (c.state_code === 'TX') {
    const demand  = renderTXDemandLetter(c)
    const preLien = renderTXPreLienNotice(c)
    const lien    = renderTXLienAffidavit(c)
    return {
      demand_letter: await renderToPdf(demand),
      doc2:          await renderToPdf(preLien),
      lien:          await renderToPdf(lien),
      doc2_name:     'pre_lien_notice',
    }
  }
  throw new Error(`unsupported state: ${c.state_code}`)
}
