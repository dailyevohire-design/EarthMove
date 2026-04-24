import { createAdminClient } from '@/lib/supabase/server'
import { generateCasePDFs } from './pdf-generator'
import { uploadCasePDFs }   from './storage'
import type { CollectionsCase } from './types'

// Pure flow: fetch paid case → render templates → upload PDFs → flip status.
// Never calls any LLM. All logic is deterministic rendering of user-entered data.
export async function generateAndStoreCase(caseId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: row, error: fetchErr } = await admin
    .from('collections_cases')
    .select('*')
    .eq('id', caseId)
    .maybeSingle()

  if (fetchErr) throw new Error(`fetch failed: ${fetchErr.message}`)
  if (!row) throw new Error(`case ${caseId} not found`)

  const caseRow = row as CollectionsCase
  if (caseRow.status !== 'paid') {
    throw new Error(`case status is ${caseRow.status}, expected 'paid'`)
  }

  try {
    const pdfs  = await generateCasePDFs(caseRow)
    const paths = await uploadCasePDFs(caseRow.user_id, caseRow.id, caseRow.state_code, pdfs)

    const update: Record<string, unknown> = {
      status: 'documents_ready',
      documents_generated_at: new Date().toISOString(),
      demand_letter_storage_path: paths.demand_letter,
      lien_document_storage_path: paths.lien,
    }
    if (caseRow.state_code === 'CO') update.notice_of_intent_storage_path = paths.doc2
    if (caseRow.state_code === 'TX') update.pre_lien_notice_storage_path  = paths.doc2

    const { error: upErr } = await admin
      .from('collections_cases')
      .update(update)
      .eq('id', caseId)
    if (upErr) throw new Error(`status update failed: ${upErr.message}`)

    await admin.from('collections_case_events').insert({
      case_id: caseId,
      event_type: 'documents_generated',
      event_payload: {
        state: caseRow.state_code,
        doc2_name: paths.doc2_name,
        bytes: {
          demand_letter: pdfs.demand_letter.byteLength,
          doc2:          pdfs.doc2.byteLength,
          lien:          pdfs.lien.byteLength,
        },
      },
      actor_user_id: caseRow.user_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin.from('collections_case_events').insert({
      case_id: caseId,
      event_type: 'error',
      event_payload: { stage: 'generateAndStoreCase', message },
      actor_user_id: caseRow.user_id,
    })
    throw err
  }
}
