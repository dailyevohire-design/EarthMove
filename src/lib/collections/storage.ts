import { createAdminClient } from '@/lib/supabase/server'
import type { CollectionsState } from './types'
import type { GeneratedCasePDFs } from './pdf-generator'

const BUCKET = 'collections'
const SIGNED_URL_TTL_SECONDS = 60 * 60

type Doc2Name = 'notice_of_intent' | 'pre_lien_notice'

export interface CasePaths {
  demand_letter: string
  doc2: string
  lien: string
  doc2_name: Doc2Name
}

export function casePaths(userId: string, caseId: string, state: CollectionsState): CasePaths {
  const doc2_name: Doc2Name = state === 'CO' ? 'notice_of_intent' : 'pre_lien_notice'
  const base = `${userId}/${caseId}`
  return {
    demand_letter: `${base}/demand_letter.pdf`,
    doc2:          `${base}/${doc2_name}.pdf`,
    lien:          `${base}/lien.pdf`,
    doc2_name,
  }
}

export async function uploadCasePDFs(
  userId: string,
  caseId: string,
  state: CollectionsState,
  pdfs: GeneratedCasePDFs,
): Promise<CasePaths> {
  const admin = createAdminClient()
  const paths = casePaths(userId, caseId, state)

  const uploads: Array<Promise<any>> = [
    admin.storage.from(BUCKET).upload(paths.demand_letter, pdfs.demand_letter, {
      contentType: 'application/pdf', upsert: true,
    }),
    admin.storage.from(BUCKET).upload(paths.doc2, pdfs.doc2, {
      contentType: 'application/pdf', upsert: true,
    }),
    admin.storage.from(BUCKET).upload(paths.lien, pdfs.lien, {
      contentType: 'application/pdf', upsert: true,
    }),
  ]

  const results = await Promise.all(uploads)
  for (const r of results) {
    if (r.error) throw new Error(`storage upload failed: ${r.error.message}`)
  }
  return paths
}

export async function getSignedDownloadUrls(
  userId: string,
  caseId: string,
  state: CollectionsState,
): Promise<{ demand_letter: string; doc2: string; lien: string; doc2_type: Doc2Name }> {
  const admin = createAdminClient()
  const paths = casePaths(userId, caseId, state)

  const [sDemand, sDoc2, sLien] = await Promise.all([
    admin.storage.from(BUCKET).createSignedUrl(paths.demand_letter, SIGNED_URL_TTL_SECONDS),
    admin.storage.from(BUCKET).createSignedUrl(paths.doc2,          SIGNED_URL_TTL_SECONDS),
    admin.storage.from(BUCKET).createSignedUrl(paths.lien,          SIGNED_URL_TTL_SECONDS),
  ])

  if (sDemand.error || !sDemand.data?.signedUrl) throw new Error('failed to sign demand_letter')
  if (sDoc2.error   || !sDoc2.data?.signedUrl)   throw new Error('failed to sign doc2')
  if (sLien.error   || !sLien.data?.signedUrl)   throw new Error('failed to sign lien')

  return {
    demand_letter: sDemand.data.signedUrl,
    doc2:          sDoc2.data.signedUrl,
    lien:          sLien.data.signedUrl,
    doc2_type:     paths.doc2_name,
  }
}
