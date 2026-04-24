import { createAdminClient } from '@/lib/supabase/server'
import type { CollectionsKitVariant, CollectionsState } from './types'
import type { GeneratedCasePDFs } from './pdf-generator'

const BUCKET = 'collections'
const SIGNED_URL_TTL_SECONDS = 60 * 60

type Doc2Name = 'notice_of_intent' | 'pre_lien_notice'

export interface CasePaths {
  instruction_packet: string
  demand_letter: string
  doc2: string | null
  lien: string | null
  doc2_name: Doc2Name | null
}

export function casePaths(userId: string, caseId: string, state: CollectionsState, variant: CollectionsKitVariant): CasePaths {
  const base = `${userId}/${caseId}`
  if (variant === 'demand_only') {
    return {
      instruction_packet: `${base}/instruction_packet.pdf`,
      demand_letter:      `${base}/demand_letter.pdf`,
      doc2: null, lien: null, doc2_name: null,
    }
  }
  const doc2_name: Doc2Name = state === 'CO' ? 'notice_of_intent' : 'pre_lien_notice'
  return {
    instruction_packet: `${base}/instruction_packet.pdf`,
    demand_letter:      `${base}/demand_letter.pdf`,
    doc2:               `${base}/${doc2_name}.pdf`,
    lien:               `${base}/lien.pdf`,
    doc2_name,
  }
}

export async function uploadCasePDFs(
  userId: string,
  caseId: string,
  state: CollectionsState,
  variant: CollectionsKitVariant,
  pdfs: GeneratedCasePDFs,
): Promise<CasePaths> {
  const admin = createAdminClient()
  const paths = casePaths(userId, caseId, state, variant)

  const uploads: Array<Promise<any>> = [
    admin.storage.from(BUCKET).upload(paths.instruction_packet, pdfs.instruction_packet, {
      contentType: 'application/pdf', upsert: true,
    }),
    admin.storage.from(BUCKET).upload(paths.demand_letter, pdfs.demand_letter, {
      contentType: 'application/pdf', upsert: true,
    }),
  ]
  if (variant === 'full_kit' && pdfs.doc2 && pdfs.lien && paths.doc2 && paths.lien) {
    uploads.push(
      admin.storage.from(BUCKET).upload(paths.doc2, pdfs.doc2, { contentType: 'application/pdf', upsert: true }),
      admin.storage.from(BUCKET).upload(paths.lien, pdfs.lien, { contentType: 'application/pdf', upsert: true }),
    )
  }

  const results = await Promise.all(uploads)
  for (const r of results) {
    if (r.error) throw new Error(`storage upload failed: ${r.error.message}`)
  }
  return paths
}

export interface SignedDownloadUrls {
  instruction_packet: string
  demand_letter: string
  doc2: string | null
  lien: string | null
  doc2_type: Doc2Name | null
  is_full_kit: boolean
}

export async function getSignedDownloadUrls(
  userId: string,
  caseId: string,
  state: CollectionsState,
  variant: CollectionsKitVariant,
): Promise<SignedDownloadUrls> {
  const admin = createAdminClient()
  const paths = casePaths(userId, caseId, state, variant)

  const [sInstruction, sDemand] = await Promise.all([
    admin.storage.from(BUCKET).createSignedUrl(paths.instruction_packet, SIGNED_URL_TTL_SECONDS),
    admin.storage.from(BUCKET).createSignedUrl(paths.demand_letter,      SIGNED_URL_TTL_SECONDS),
  ])
  if (sInstruction.error || !sInstruction.data?.signedUrl) throw new Error('failed to sign instruction_packet')
  if (sDemand.error      || !sDemand.data?.signedUrl)      throw new Error('failed to sign demand_letter')

  if (variant === 'demand_only') {
    return {
      instruction_packet: sInstruction.data.signedUrl,
      demand_letter:      sDemand.data.signedUrl,
      doc2: null, lien: null, doc2_type: null, is_full_kit: false,
    }
  }
  const [sDoc2, sLien] = await Promise.all([
    admin.storage.from(BUCKET).createSignedUrl(paths.doc2!, SIGNED_URL_TTL_SECONDS),
    admin.storage.from(BUCKET).createSignedUrl(paths.lien!, SIGNED_URL_TTL_SECONDS),
  ])
  if (sDoc2.error || !sDoc2.data?.signedUrl) throw new Error('failed to sign doc2')
  if (sLien.error || !sLien.data?.signedUrl) throw new Error('failed to sign lien')

  return {
    instruction_packet: sInstruction.data.signedUrl,
    demand_letter:      sDemand.data.signedUrl,
    doc2:               sDoc2.data.signedUrl,
    lien:               sLien.data.signedUrl,
    doc2_type:          paths.doc2_name,
    is_full_kit:        true,
  }
}
