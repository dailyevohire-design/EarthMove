import { describe, it, expect, vi, beforeEach } from 'vitest'

let flagEnabled = true
vi.mock('@/lib/collections/feature-flag', async () => {
  const actual = await vi.importActual<any>('@/lib/collections/feature-flag')
  return {
    ...actual,
    isCollectionsEnabled: () => flagEnabled,
    assertCollectionsEnabled: () => { if (!flagEnabled) throw new Error('COLLECTIONS_DISABLED') },
  }
})

let authedUser: any = { id: 'user-1' }
let rlsCaseRow: any = null
let adminCaseRow: any = null
const adminUpdates: any[] = []
const adminEventInserts: any[] = []

function makeQb(finalValue: any) {
  const chain: any = {}
  for (const m of ['select','eq','is','order','limit','single','maybeSingle']) chain[m] = vi.fn(() => chain)
  chain.then = (ok: any) => Promise.resolve(finalValue).then(ok)
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: authedUser }, error: null }) },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: rlsCaseRow, error: null }),
        }),
      }),
    }),
  }),
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'collections_cases') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: adminCaseRow, error: null }),
            }),
          }),
          update: (values: any) => ({
            eq: (_c: string, _v: any) => { adminUpdates.push(values); return Promise.resolve({ error: null }) },
          }),
        }
      }
      if (table === 'collections_case_events') {
        return { insert: (row: any) => { adminEventInserts.push(row); return Promise.resolve({ error: null }) } }
      }
      return makeQb({ data: null, error: null })
    },
  }),
}))

const generateCalls: string[] = []
let shouldGenerate = true
vi.mock('@/lib/collections/generator', () => ({
  generateAndStoreCase: async (id: string) => {
    generateCalls.push(id)
    if (!shouldGenerate) throw new Error('generation failed')
    // flip admin case row to documents_ready to mimic the update inside the real generator
    adminCaseRow = { ...adminCaseRow, status: 'documents_ready' }
  },
}))

const signedUrlCalls: any[] = []
vi.mock('@/lib/collections/storage', () => ({
  casePaths: (uid: string, cid: string, st: 'CO' | 'TX') => ({
    demand_letter: `${uid}/${cid}/demand_letter.pdf`,
    doc2: st === 'CO' ? `${uid}/${cid}/notice_of_intent.pdf` : `${uid}/${cid}/pre_lien_notice.pdf`,
    lien: `${uid}/${cid}/lien.pdf`,
    doc2_name: st === 'CO' ? 'notice_of_intent' : 'pre_lien_notice',
  }),
  getSignedDownloadUrls: async (uid: string, cid: string, st: 'CO' | 'TX') => {
    signedUrlCalls.push({ uid, cid, st })
    return {
      demand_letter: `https://signed/${cid}/demand`,
      doc2:          `https://signed/${cid}/doc2`,
      lien:          `https://signed/${cid}/lien`,
      doc2_type:     st === 'CO' ? 'notice_of_intent' : 'pre_lien_notice',
    }
  },
}))

import { GET } from '@/app/api/collections/[id]/download/route'

function mkReq() {
  return {} as any
}
function mkParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  adminUpdates.length = 0
  adminEventInserts.length = 0
  generateCalls.length = 0
  signedUrlCalls.length = 0
  flagEnabled = true
  authedUser = { id: 'user-1' }
  shouldGenerate = true
})

describe('GET /api/collections/[id]/download', () => {
  it('1. status=paid + not generated → triggers generateAndStoreCase + returns 3 URLs', async () => {
    rlsCaseRow   = { id: 'case-1', user_id: 'user-1', status: 'paid', state_code: 'CO', documents_generated_at: null, download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-1', user_id: 'user-1', status: 'paid', state_code: 'CO', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-1'))
    expect(res.status).toBe(200)
    expect(generateCalls).toEqual(['case-1'])
    const body = await res.json()
    expect(body.demand_letter).toMatch(/demand/)
    expect(body.doc2).toMatch(/doc2/)
    expect(body.lien).toMatch(/lien/)
  })

  it('2. case owned by different user → 404', async () => {
    rlsCaseRow = null // RLS filters out
    const res = await GET(mkReq(), mkParams('case-other'))
    expect(res.status).toBe(404)
  })

  it('3. refunded → 410', async () => {
    rlsCaseRow = { id: 'case-r', user_id: 'user-1', status: 'refunded', state_code: 'CO', documents_generated_at: null, download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-r'))
    expect(res.status).toBe(410)
  })

  it('4. documents_ready → 3 URLs, increments download_count', async () => {
    rlsCaseRow   = { id: 'case-dr', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', documents_generated_at: new Date().toISOString(), download_count: 2, first_downloaded_at: '2026-04-01T00:00:00Z' }
    adminCaseRow = { id: 'case-dr', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', download_count: 2, first_downloaded_at: '2026-04-01T00:00:00Z' }
    const res = await GET(mkReq(), mkParams('case-dr'))
    expect(res.status).toBe(200)
    const lastUpdate = adminUpdates[adminUpdates.length - 1]
    expect(lastUpdate.download_count).toBe(3)
  })

  it('5. first download sets first_downloaded_at and status=downloaded', async () => {
    rlsCaseRow   = { id: 'case-first', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-first', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-first'))
    expect(res.status).toBe(200)
    const lastUpdate = adminUpdates[adminUpdates.length - 1]
    expect(lastUpdate.first_downloaded_at).toBeTruthy()
    expect(lastUpdate.status).toBe('downloaded')
  })

  it('6. CO download → doc2_type=notice_of_intent', async () => {
    rlsCaseRow   = { id: 'case-co', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-co', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-co'))
    const body = await res.json()
    expect(body.doc2_type).toBe('notice_of_intent')
  })

  it('7. TX download → doc2_type=pre_lien_notice', async () => {
    rlsCaseRow   = { id: 'case-tx', user_id: 'user-1', status: 'documents_ready', state_code: 'TX', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-tx', user_id: 'user-1', status: 'documents_ready', state_code: 'TX', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-tx'))
    const body = await res.json()
    expect(body.doc2_type).toBe('pre_lien_notice')
  })
})
