/**
 * High-level entry point: take a trust_reports row + supporting data, return
 * a PDF Buffer. Loads the brand PNG assets from public/brand/, registers
 * fonts, derives verification chips, calls @react-pdf/renderer.
 *
 * Used by:
 *   - src/app/api/trust/report/[reportId]/pdf/route.ts (production endpoint)
 *   - scripts/generate-pdf-fixtures.ts (sample generation for QA)
 */

import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { TrustPdfDocument, type TrustPdfReportInput } from './TrustPdfDocument'
import { deriveChips, type ChipInput } from './chip-state'
import { registerPdfFonts } from './fonts'

export interface RenderTrustPdfInput {
  report: TrustPdfReportInput & {
    id: string
    biz_status: string | null
    lic_status: string | null
    osha_status: string | null
    bbb_rating: string | null
  }
  /** Evidence row count for the chain-verify footer (paid tier only). */
  evidenceCount: number | null
  /** Source-keys that errored during evidence collection (paid-tier only). */
  errored_source_keys?: Set<string>
  /**
   * Origin used to construct the QR target URL. Production: req.nextUrl.origin.
   * Scripts/fixtures: pass 'https://earthmove.io' or similar.
   */
  origin: string
}

const PUBLIC_DIR = path.join(process.cwd(), 'public/brand')
const WORDMARK_PATH = path.join(PUBLIC_DIR, 'groundcheck-wordmark.png')
const STAMP_PATH = path.join(PUBLIC_DIR, 'groundcheck-stamp.png')

function loadBrandAsset(filePath: string, label: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[trust-pdf] Required brand asset missing: ${label} at ${filePath}. ` +
      `scp the canonical PNG into public/brand/ before regenerating reports.`,
    )
  }
  return fs.readFileSync(filePath)
}

export async function renderTrustPdf(input: RenderTrustPdfInput): Promise<Buffer> {
  registerPdfFonts()

  const wordmarkPng = loadBrandAsset(WORDMARK_PATH, 'wordmark')
  const stampPng = loadBrandAsset(STAMP_PATH, 'stamp')

  const chipInput: ChipInput = {
    biz_status: input.report.biz_status ?? null,
    lic_status: input.report.lic_status ?? null,
    osha_status: input.report.osha_status ?? null,
    bbb_rating: input.report.bbb_rating ?? null,
    errored_source_keys: input.errored_source_keys,
  }
  const chips = deriveChips(chipInput)

  // QR + chain footer are paid-tier only. Free-tier reports have job_id=null
  // and skip both, surfacing a "chain verification available on paid plans"
  // note instead (per PR #17).
  let qrPng: Buffer | null = null
  if (input.report.job_id) {
    const verifyUrl = `${input.origin}/trust/verify/${input.report.id}`
    qrPng = await QRCode.toBuffer(verifyUrl, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  }

  const doc = React.createElement(TrustPdfDocument, {
    report: input.report,
    chips,
    wordmarkPng,
    stampPng,
    qrPng,
    evidenceCount: input.report.job_id ? (input.evidenceCount ?? 0) : null,
    reportId: input.report.id,
  })

  return await renderToBuffer(doc as unknown as React.ReactElement)
}
