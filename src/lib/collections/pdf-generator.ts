// -----------------------------------------------------------------------------
// CUSTOMER VERIFICATION REQUIRED rendering
// -----------------------------------------------------------------------------
//
// Option C kit model: every uncertain statutory question is rendered as a
// highly visible CUSTOMER VERIFICATION REQUIRED callout in the output PDF,
// not hidden behind a disclaimer. A CUSTOMER VERIFICATION REQUIRED callout is:
//   - full-width amber box
//   - header: "[!] CUSTOMER VERIFICATION REQUIRED"
//   - statute section line
//   - plain-English description
//   - cross-reference to the instruction packet section
//
// Each filing document ALSO carries a top-of-page-1 "NOT READY TO FILE" amber
// banner reinforcing that a CUSTOMER VERIFICATION REQUIRED callout (or several)
// must be addressed before filing.
//
// Instruction packets do NOT carry the NOT READY TO FILE banner because they
// are not themselves filing documents — they are the education layer that
// explains the CUSTOMER VERIFICATION REQUIRED flow.
//
// See docs/LEGAL_POSTURE.md §2 for why the CUSTOMER VERIFICATION REQUIRED
// markers are visible in the output (stronger Medlock/Nolo posture than
// the f1b7fc8 hidden-marker model).
// -----------------------------------------------------------------------------

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { marked } from 'marked'
import type { CollectionsCase } from './types'
import { renderCODemandLetter }    from './templates/co/demand-letter'
import { renderCOMechanicsLien }   from './templates/co/mechanics-lien'
import { renderCONoticeOfIntent }  from './templates/co/notice-of-intent'
import { renderTXDemandLetter }    from './templates/tx/demand-letter'
import { renderTXLienAffidavit }   from './templates/tx/lien-affidavit'
import { renderTXPreLienNotice }   from './templates/tx/pre-lien-notice'
import type { RenderedDocument } from './templates/shared'
import { CV_MARKER_RE, parseCustomerVerification } from './templates/shared'
import { renderCOInstructionPacket } from './templates/co/instruction-packet'
import { renderTXInstructionPacket } from './templates/tx/instruction-packet'

export interface GeneratedCasePDFs {
  demand_letter: Uint8Array
  doc2: Uint8Array | null
  lien: Uint8Array | null
  instruction_packet: Uint8Array
  doc2_name: 'notice_of_intent' | 'pre_lien_notice' | null
  is_full_kit: boolean
}

// US Letter
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 72
const FOOTER_HEIGHT = 54
const HEADER_HEIGHT = 40
const CONTENT_W = PAGE_W - 2 * MARGIN

const BODY_SIZE = 11
const HEADING_SIZE = 13
const HEADER_SIZE = 9
const SHORT_DISCLAIMER_SIZE = 8
const FOOTER_SIZE = 7
const BANNER_SIZE = 11

const COLOR_BLACK     = rgb(0, 0, 0)
const COLOR_STONE     = rgb(0.44, 0.44, 0.44)
const COLOR_WHITE     = rgb(1, 1, 1)
const COLOR_AMBER_700 = rgb(180 / 255,  83 / 255,   9 / 255)
const COLOR_AMBER_800 = rgb(140 / 255,  60 / 255,   5 / 255)
const COLOR_AMBER_BG  = rgb(255 / 255, 243 / 255, 191 / 255)
const COLOR_AMBER_BORDER = rgb(194 / 255, 120 / 255, 3 / 255)
const COLOR_AMBER_FOOT = rgb(100 / 255, 60 / 255, 10 / 255)

// -----------------------------------------------------------------------------
// Layout primitives
// -----------------------------------------------------------------------------

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

// pdf-lib StandardFonts encode WinAnsi. Strip/replace anything outside the
// supported Latin-1-ish set so drawText doesn't throw on exotic characters
// that slip in (e.g. from user-entered addresses or markdown code snippets).
function sanitizeForStandardFont(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/–/g, '-')
    .replace(/→/g, '->')
    .replace(/⇨/g, '=>')
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ—§]/g, '')
}

// -----------------------------------------------------------------------------
// Chrome (header + footer) + top banner
// -----------------------------------------------------------------------------

interface ChromeContext {
  sans: PDFFont
  doc: RenderedDocument
  showFilingBanner: boolean
  packetHeader?: string
}

function drawChrome(
  page: PDFPage,
  pageNum: number,
  pageTotal: number,
  ctx: ChromeContext,
) {
  const { sans, doc, packetHeader } = ctx
  const headerText = packetHeader ?? 'GENERATED DOCUMENT — NOT LEGAL ADVICE'
  page.drawText(headerText, {
    x: MARGIN, y: PAGE_H - MARGIN + 16,
    size: HEADER_SIZE, font: sans, color: COLOR_STONE,
  })
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN + 8 },
    end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN + 8 },
    thickness: 0.5, color: COLOR_STONE,
  })
  page.drawText(
    'Earth Pro Connect LLC is not a law firm. Consult an attorney licensed in the property state before filing.',
    { x: MARGIN, y: PAGE_H - MARGIN - 4, size: SHORT_DISCLAIMER_SIZE, font: sans, color: COLOR_STONE },
  )

  const footerLines = wrap(sanitizeForStandardFont(doc.disclaimerFooter), sans, FOOTER_SIZE, CONTENT_W)
  let fy = FOOTER_HEIGHT - 8
  for (const line of footerLines.slice(0, 5)) {
    page.drawText(line, { x: MARGIN, y: fy, size: FOOTER_SIZE, font: sans, color: COLOR_STONE })
    fy -= FOOTER_SIZE + 1
  }
  page.drawText(`Page ${pageNum} of ${pageTotal}`, {
    x: PAGE_W - MARGIN - 60, y: 20, size: FOOTER_SIZE, font: sans, color: COLOR_STONE,
  })
}

// Full-width amber banner at top of page 1 for filing documents.
// Prints on top of the normal content area (body starts below it).
function drawFilingBanner(page: PDFPage, fontBold: PDFFont): number {
  const bannerH = 28
  const bannerY = PAGE_H - MARGIN - HEADER_HEIGHT - bannerH + 28
  page.drawRectangle({
    x: MARGIN, y: bannerY,
    width: PAGE_W - 2 * MARGIN, height: bannerH,
    color: COLOR_AMBER_700,
  })
  const text = sanitizeForStandardFont(
    'NOT READY TO FILE — Read the Instruction Packet first. This document contains verification steps you must complete before filing.',
  )
  // Wrap for the narrow banner
  const lines = wrap(text, fontBold, BANNER_SIZE, PAGE_W - 2 * MARGIN - 16)
  let ty = bannerY + bannerH - 14
  for (const line of lines.slice(0, 2)) {
    page.drawText(line, { x: MARGIN + 10, y: ty, size: BANNER_SIZE, font: fontBold, color: COLOR_WHITE })
    ty -= BANNER_SIZE + 2
  }
  return bannerY - 8   // y-cursor immediately below banner
}

// -----------------------------------------------------------------------------
// Customer-verification callout box
// -----------------------------------------------------------------------------

interface Fonts { font: PDFFont; fontBold: PDFFont; fontItalic: PDFFont; sans: PDFFont; sansBold: PDFFont }

function calloutHeight(
  description: string,
  fonts: Fonts,
  maxWidth: number,
): number {
  const PAD_Y = 10
  const HEADER_H = 11
  const META_H = 10
  const DESC_SIZE = 10
  const descLines = wrap(sanitizeForStandardFont(description), fonts.font, DESC_SIZE, maxWidth - 20)
  return PAD_Y * 2 + HEADER_H + 4 + META_H + 4 + descLines.length * (DESC_SIZE + 3) + META_H + 4
}

function drawCalloutBox(
  page: PDFPage,
  yTop: number,
  parsed: { state: 'CO' | 'TX'; statuteSection: string; description: string; packetSection: string },
  fonts: Fonts,
  maxWidth: number,
): number {
  const PAD_X = 10
  const PAD_Y = 10
  const HEADER_SIZE_CB = 10
  const META_SIZE = 9
  const DESC_SIZE = 10

  const descLines = wrap(sanitizeForStandardFont(parsed.description), fonts.font, DESC_SIZE, maxWidth - 2 * PAD_X)
  const totalH = PAD_Y * 2 + HEADER_SIZE_CB + 4 + META_SIZE + 4 + descLines.length * (DESC_SIZE + 3) + META_SIZE + 4

  const boxY = yTop - totalH
  page.drawRectangle({
    x: MARGIN, y: boxY,
    width: maxWidth, height: totalH,
    color: COLOR_AMBER_BG,
    borderColor: COLOR_AMBER_BORDER,
    borderWidth: 1,
  })

  let tY = yTop - PAD_Y - HEADER_SIZE_CB
  page.drawText('[!] CUSTOMER VERIFICATION REQUIRED', {
    x: MARGIN + PAD_X, y: tY, size: HEADER_SIZE_CB, font: fonts.sansBold, color: COLOR_AMBER_800,
  })
  tY -= HEADER_SIZE_CB + 4
  page.drawText(`Verify against: ${sanitizeForStandardFont(parsed.statuteSection)}`, {
    x: MARGIN + PAD_X, y: tY, size: META_SIZE, font: fonts.sans, color: COLOR_BLACK,
  })
  tY -= META_SIZE + 4
  for (const line of descLines) {
    page.drawText(line, {
      x: MARGIN + PAD_X, y: tY, size: DESC_SIZE, font: fonts.font, color: COLOR_BLACK,
    })
    tY -= DESC_SIZE + 3
  }
  page.drawText(`See: ${sanitizeForStandardFont(parsed.packetSection)}`, {
    x: MARGIN + PAD_X, y: tY, size: META_SIZE, font: fonts.fontItalic, color: COLOR_AMBER_FOOT,
  })

  return boxY - 8
}

// -----------------------------------------------------------------------------
// Filing-doc rendering
// -----------------------------------------------------------------------------

async function renderFilingDocPdf(doc: RenderedDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title)
  pdf.setProducer('Earth Pro Connect LLC — Contractor Payment Kit')
  pdf.setCreator('Earth Pro Connect LLC — Contractor Payment Kit')

  const font       = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold   = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const sans       = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold   = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fonts: Fonts = { font, fontBold, fontItalic, sans, sansBold }

  const topY = PAGE_H - MARGIN - HEADER_HEIGHT + 20
  const bottomY = MARGIN + FOOTER_HEIGHT

  const pages: PDFPage[] = []
  let page = pdf.addPage([PAGE_W, PAGE_H])
  pages.push(page)

  // Page 1: banner first, then title + body
  let y = drawFilingBanner(page, sansBold)

  // Title
  const titleText = sanitizeForStandardFont(doc.title.toUpperCase())
  const titleLines = wrap(titleText, fontBold, HEADING_SIZE, CONTENT_W)
  for (const l of titleLines) {
    page.drawText(l, { x: MARGIN, y, size: HEADING_SIZE, font: fontBold, color: COLOR_BLACK })
    y -= HEADING_SIZE + 4
  }
  y -= 6

  const bodyLineHeight = BODY_SIZE + 4

  // Walk the body: detect callout markers; paragraphs of non-marker text wrap normally.
  const rawLines = doc.body.split('\n')

  const ensureRoom = (need: number) => {
    if (y - need < bottomY) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = topY
    }
  }

  for (const raw of rawLines) {
    if (raw === '') { y -= bodyLineHeight * 0.6; continue }

    // Does this line contain a callout marker?
    const markerMatch = raw.match(CV_MARKER_RE)
    if (markerMatch) {
      for (const marker of markerMatch) {
        const parsed = parseCustomerVerification(marker)
        if (!parsed) continue
        const needed = calloutHeight(parsed.description, fonts, CONTENT_W)
        ensureRoom(needed + 6)
        y = drawCalloutBox(page, y, parsed, fonts, CONTENT_W)
      }
      // If the line had text outside the marker, render that text too
      const plain = raw.replace(CV_MARKER_RE, '').trim()
      if (plain) {
        const plainLines = wrap(sanitizeForStandardFont(plain), font, BODY_SIZE, CONTENT_W)
        for (const pl of plainLines) {
          ensureRoom(bodyLineHeight)
          page.drawText(pl, { x: MARGIN, y, size: BODY_SIZE, font, color: COLOR_BLACK })
          y -= bodyLineHeight
        }
      }
      continue
    }

    const wrapped = wrap(sanitizeForStandardFont(raw), font, BODY_SIZE, CONTENT_W)
    for (const wl of wrapped) {
      ensureRoom(bodyLineHeight)
      page.drawText(wl, { x: MARGIN, y, size: BODY_SIZE, font, color: COLOR_BLACK })
      y -= bodyLineHeight
    }
  }

  const total = pages.length
  const ctx: ChromeContext = { sans, doc, showFilingBanner: true }
  pages.forEach((p, i) => drawChrome(p, i + 1, total, ctx))

  return await pdf.save()
}

// -----------------------------------------------------------------------------
// Instruction-packet rendering (markdown → PDF)
// -----------------------------------------------------------------------------

export interface InstructionSection {
  slug: string
  title: string
  bodyMarkdown: string
}

export interface InstructionPacketInput {
  title: string
  sections: InstructionSection[]
  kitVariant: 'full_kit' | 'demand_only'
  stateLabel: string
  caseSummary: string[]   // lines to render in the front page summary box
}

export async function renderInstructionPacketPdf(input: InstructionPacketInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(input.title)
  pdf.setProducer('Earth Pro Connect LLC — Contractor Payment Kit')
  pdf.setCreator('Earth Pro Connect LLC — Contractor Payment Kit')

  const font       = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold   = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const mono       = await pdf.embedFont(StandardFonts.Courier)
  const sans       = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold   = await pdf.embedFont(StandardFonts.HelveticaBold)

  const topY    = PAGE_H - MARGIN - HEADER_HEIGHT + 20
  const bottomY = MARGIN + FOOTER_HEIGHT
  const lineH   = BODY_SIZE + 4

  const pages: Array<{ page: PDFPage; headerTitle: string }> = []
  let currentHeader = input.title
  let page = pdf.addPage([PAGE_W, PAGE_H])
  pages.push({ page, headerTitle: currentHeader })
  let y = topY

  const ensureRoom = (need: number) => {
    if (y - need < bottomY) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pages.push({ page, headerTitle: currentHeader })
      y = topY
    }
  }

  // Page 1: cover + summary
  page.drawText(sanitizeForStandardFont(input.title), { x: MARGIN, y, size: 20, font: fontBold, color: COLOR_BLACK })
  y -= 28
  page.drawText(`${input.stateLabel} — ${input.kitVariant === 'full_kit' ? 'Full Kit' : 'Demand-Only Variant'}`, {
    x: MARGIN, y, size: 12, font: fontItalic, color: COLOR_STONE,
  })
  y -= 24
  // Summary box
  const boxLines = input.caseSummary.slice(0, 10).map(sanitizeForStandardFont)
  const boxH = boxLines.length * (BODY_SIZE + 3) + 20
  page.drawRectangle({
    x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH,
    color: rgb(0.96, 0.97, 0.96),
    borderColor: rgb(0.8, 0.82, 0.8), borderWidth: 0.5,
  })
  let sy = y - 14
  for (const line of boxLines) {
    page.drawText(line, { x: MARGIN + 10, y: sy, size: BODY_SIZE, font, color: COLOR_BLACK })
    sy -= BODY_SIZE + 3
  }
  y = y - boxH - 18

  // Table of contents (page 2)
  page = pdf.addPage([PAGE_W, PAGE_H])
  currentHeader = 'Table of Contents'
  pages.push({ page, headerTitle: currentHeader })
  y = topY
  page.drawText('Table of Contents', { x: MARGIN, y, size: 18, font: fontBold, color: COLOR_BLACK })
  y -= 28
  for (const s of input.sections) {
    const line = sanitizeForStandardFont(`${s.title}`)
    const wrapped = wrap(line, font, BODY_SIZE, CONTENT_W)
    for (const wl of wrapped) {
      ensureRoom(lineH)
      page.drawText(wl, { x: MARGIN, y, size: BODY_SIZE, font, color: COLOR_BLACK })
      y -= lineH
    }
  }

  // Walk each section
  for (const section of input.sections) {
    // New page per section
    page = pdf.addPage([PAGE_W, PAGE_H])
    currentHeader = section.title
    pages.push({ page, headerTitle: currentHeader })
    y = topY

    page.drawText(sanitizeForStandardFont(section.title), {
      x: MARGIN, y, size: 16, font: fontBold, color: COLOR_BLACK,
    })
    y -= 24

    const tokens = marked.lexer(section.bodyMarkdown)
    for (const tok of tokens as any[]) {
      y = renderToken(page, y, tok, { font, fontBold, fontItalic, mono, sans, sansBold }, ensureRoom, () => page, (p) => { page = p })
    }
  }

  // Chrome — use a "packetHeader" that swaps per-section.
  const total = pages.length
  pages.forEach((entry, i) => {
    drawChrome(entry.page, i + 1, total, {
      sans, doc: { title: input.title, body: '', disclaimerHeader: '', disclaimerFooter:
        'Earth Pro Connect LLC is not a law firm. This packet does not provide legal advice and does not create an attorney-client relationship. Consult an attorney licensed in the property state before filing any document.',
      }, showFilingBanner: false,
      packetHeader: i === 0 ? input.title : `Contractor Payment Kit — ${entry.headerTitle}`,
    })
  })

  return await pdf.save()
}

interface PacketFonts {
  font: PDFFont; fontBold: PDFFont; fontItalic: PDFFont
  mono: PDFFont; sans: PDFFont; sansBold: PDFFont
}

function renderToken(
  pageIn: PDFPage,
  yIn: number,
  tok: any,
  fonts: PacketFonts,
  ensureRoom: (need: number) => void,
  getPage: () => PDFPage,
  _setPage: (p: PDFPage) => void,
): number {
  let y = yIn
  let page = pageIn
  const lineH = BODY_SIZE + 4

  const drawWrapped = (text: string, size: number, fnt: PDFFont, color = COLOR_BLACK) => {
    const lines = wrap(sanitizeForStandardFont(text), fnt, size, CONTENT_W)
    for (const l of lines) {
      ensureRoom(size + 4)
      page = getPage()
      page.drawText(l, { x: MARGIN, y, size, font: fnt, color })
      y -= size + 4
    }
  }

  switch (tok.type) {
    case 'space':
      y -= 6
      break
    case 'heading': {
      const size = tok.depth === 1 ? 16 : tok.depth === 2 ? 13 : 11
      ensureRoom(size + 10)
      page = getPage()
      drawWrapped(tok.text, size, fonts.fontBold)
      y -= 4
      break
    }
    case 'paragraph':
      drawWrapped(tok.text, BODY_SIZE, fonts.font)
      y -= 4
      break
    case 'blockquote': {
      // Indent + thin left rule
      const save = y
      for (const inner of (tok.tokens ?? [])) {
        y = renderToken(page, y, inner, fonts, ensureRoom, getPage, _setPage)
      }
      page = getPage()
      page.drawLine({ start: { x: MARGIN + 4, y: save }, end: { x: MARGIN + 4, y: y + 4 }, thickness: 1, color: COLOR_STONE })
      break
    }
    case 'list': {
      const items = tok.items ?? []
      items.forEach((item: any, idx: number) => {
        const prefix = tok.ordered ? `${idx + 1}. ` : '•  '
        const text = item.text ?? ''
        const lines = wrap(sanitizeForStandardFont(prefix + text), fonts.font, BODY_SIZE, CONTENT_W - 12)
        for (let i = 0; i < lines.length; i++) {
          ensureRoom(lineH)
          page = getPage()
          page.drawText(lines[i], { x: MARGIN + (i === 0 ? 0 : 18), y, size: BODY_SIZE, font: fonts.font, color: COLOR_BLACK })
          y -= lineH
        }
      })
      y -= 4
      break
    }
    case 'code': {
      const lines = String(tok.text ?? '').split('\n')
      for (const l of lines) {
        ensureRoom(lineH)
        page = getPage()
        page.drawText(sanitizeForStandardFont(l), { x: MARGIN + 6, y, size: 9.5, font: fonts.mono, color: rgb(0.2, 0.2, 0.2) })
        y -= lineH
      }
      y -= 4
      break
    }
    case 'table': {
      // Minimal table: header + rows, even column widths
      const hdr: any[] = tok.header ?? []
      const rows: any[][] = tok.rows ?? []
      const colCount = hdr.length || 1
      const colW = CONTENT_W / colCount
      const drawRow = (cells: any[], bold: boolean) => {
        const wrappedCells = cells.map(c => wrap(sanitizeForStandardFont(String((c.text ?? c) as any)), bold ? fonts.fontBold : fonts.font, BODY_SIZE, colW - 6))
        const height = Math.max(...wrappedCells.map(w => w.length)) * (BODY_SIZE + 3) + 6
        ensureRoom(height)
        page = getPage()
        wrappedCells.forEach((cellLines, ci) => {
          let cy = y - BODY_SIZE
          for (const cl of cellLines) {
            page.drawText(cl, { x: MARGIN + ci * colW + 2, y: cy, size: BODY_SIZE, font: bold ? fonts.fontBold : fonts.font, color: COLOR_BLACK })
            cy -= BODY_SIZE + 3
          }
        })
        y -= height
      }
      drawRow(hdr, true)
      rows.forEach(r => drawRow(r, false))
      y -= 4
      break
    }
    case 'hr':
      ensureRoom(6)
      page = getPage()
      page.drawLine({
        start: { x: MARGIN, y: y - 3 }, end: { x: PAGE_W - MARGIN, y: y - 3 },
        thickness: 0.5, color: COLOR_STONE,
      })
      y -= 8
      break
    default:
      // Fallback: render raw text if present
      if (typeof (tok as any).text === 'string') drawWrapped((tok as any).text, BODY_SIZE, fonts.font)
      break
  }
  return y
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

export async function generateCasePDFs(c: CollectionsCase): Promise<GeneratedCasePDFs> {
  if (c.state_code === 'CO') {
    const instruction = await renderCOInstructionPacket(c)
    if (c.kit_variant === 'demand_only') {
      const demand = renderCODemandLetter(c)
      return {
        instruction_packet: instruction,
        demand_letter:      await renderFilingDocPdf(demand),
        doc2: null, lien: null, doc2_name: null, is_full_kit: false,
      }
    }
    const demand = renderCODemandLetter(c)
    const notice = renderCONoticeOfIntent(c)
    const lien   = renderCOMechanicsLien(c)
    return {
      instruction_packet: instruction,
      demand_letter:      await renderFilingDocPdf(demand),
      doc2:               await renderFilingDocPdf(notice),
      lien:               await renderFilingDocPdf(lien),
      doc2_name:          'notice_of_intent',
      is_full_kit:        true,
    }
  }
  if (c.state_code === 'TX') {
    const instruction = await renderTXInstructionPacket(c)
    if (c.kit_variant === 'demand_only') {
      const demand = renderTXDemandLetter(c)
      return {
        instruction_packet: instruction,
        demand_letter:      await renderFilingDocPdf(demand),
        doc2: null, lien: null, doc2_name: null, is_full_kit: false,
      }
    }
    const demand  = renderTXDemandLetter(c)
    const preLien = renderTXPreLienNotice(c)
    const lien    = renderTXLienAffidavit(c)
    return {
      instruction_packet: instruction,
      demand_letter:      await renderFilingDocPdf(demand),
      doc2:               await renderFilingDocPdf(preLien),
      lien:               await renderFilingDocPdf(lien),
      doc2_name:          'pre_lien_notice',
      is_full_kit:        true,
    }
  }
  throw new Error(`unsupported state: ${c.state_code}`)
}
