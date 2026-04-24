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
            eq: () => ({ maybeSingle: async () => ({ data: adminCaseRow, error: null }) }),
          }),
          update: (values: any) => ({
            eq: (_c: string, _v: any) => { adminUpdates.push(values); return Promise.resolve({ error: null }) },
          }),
        }
      }
      if (table === 'collections_case_events') {
        return { insert: (row: any) => { adminEventInserts.push(row); return Promise.resolve({ error: null }) } }
      }
      const chain: any = {}
      for (const m of ['select','eq','is','single','maybeSingle']) chain[m] = vi.fn(() => chain)
      chain.then = (ok: any) => Promise.resolve({ data: null, error: null }).then(ok)
      return chain
    },
  }),
}))

const generateCalls: string[] = []
let shouldGenerate = true
vi.mock('@/lib/collections/generator', () => ({
  generateAndStoreCase: async (id: string) => {
    generateCalls.push(id)
    if (!shouldGenerate) throw new Error('generation failed')
    adminCaseRow = { ...adminCaseRow, status: 'documents_ready' }
  },
}))

const signedUrlCalls: any[] = []
vi.mock('@/lib/collections/storage', () => ({
  casePaths: (uid: string, cid: string, _st: 'CO' | 'TX', _variant: 'full_kit' | 'demand_only') => ({
    instruction_packet: `${uid}/${cid}/instruction_packet.pdf`,
    demand_letter:      `${uid}/${cid}/demand_letter.pdf`,
    doc2: null, lien: null, doc2_name: null,
  }),
  getSignedDownloadUrls: async (uid: string, cid: string, st: 'CO' | 'TX', variant: 'full_kit' | 'demand_only') => {
    signedUrlCalls.push({ uid, cid, st, variant })
    if (variant === 'demand_only') {
      return {
        instruction_packet: `https://signed/${cid}/inst`,
        demand_letter:      `https://signed/${cid}/demand`,
        doc2: null, lien: null, doc2_type: null, is_full_kit: false,
      }
    }
    return {
      instruction_packet: `https://signed/${cid}/inst`,
      demand_letter:      `https://signed/${cid}/demand`,
      doc2:               `https://signed/${cid}/doc2`,
      lien:               `https://signed/${cid}/lien`,
      doc2_type:          st === 'CO' ? 'notice_of_intent' : 'pre_lien_notice',
      is_full_kit:        true,
    }
  },
}))

import { GET } from '@/app/api/collections/[id]/download/route'

function mkReq() { return {} as any }
function mkParams(id: string) { return { params: Promise.resolve({ id }) } }

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
  it('1. paid + not generated → triggers generation and returns kit URLs', async () => {
    rlsCaseRow   = { id: 'case-1', user_id: 'user-1', status: 'paid', state_code: 'CO', kit_variant: 'full_kit', documents_generated_at: null, download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-1', user_id: 'user-1', status: 'paid', state_code: 'CO', kit_variant: 'full_kit', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-1'))
    expect(res.status).toBe(200)
    expect(generateCalls).toEqual(['case-1'])
    const body = await res.json()
    expect(body.instruction_packet).toMatch(/inst/)
    expect(body.demand_letter).toMatch(/demand/)
  })

  it('2. case owned by different user → 404 (RLS filter)', async () => {
    rlsCaseRow = null
    const res = await GET(mkReq(), mkParams('case-other'))
    expect(res.status).toBe(404)
  })

  it('3. refunded → 410', async () => {
    rlsCaseRow = { id: 'case-r', user_id: 'user-1', status: 'refunded', state_code: 'CO', kit_variant: 'full_kit', documents_generated_at: null, download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-r'))
    expect(res.status).toBe(410)
  })

  it('4. documents_ready → increments download_count', async () => {
    rlsCaseRow   = { id: 'case-dr', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', kit_variant: 'full_kit', documents_generated_at: new Date().toISOString(), download_count: 2, first_downloaded_at: '2026-04-01T00:00:00Z' }
    adminCaseRow = { id: 'case-dr', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', kit_variant: 'full_kit', download_count: 2, first_downloaded_at: '2026-04-01T00:00:00Z' }
    const res = await GET(mkReq(), mkParams('case-dr'))
    expect(res.status).toBe(200)
    const lastUpdate = adminUpdates[adminUpdates.length - 1]
    expect(lastUpdate.download_count).toBe(3)
  })

  it('5. first download sets first_downloaded_at and status=downloaded', async () => {
    rlsCaseRow   = { id: 'case-first', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', kit_variant: 'full_kit', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { id: 'case-first', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', kit_variant: 'full_kit', download_count: 0, first_downloaded_at: null }
    const res = await GET(mkReq(), mkParams('case-first'))
    expect(res.status).toBe(200)
    const lastUpdate = adminUpdates[adminUpdates.length - 1]
    expect(lastUpdate.first_downloaded_at).toBeTruthy()
    expect(lastUpdate.status).toBe('downloaded')
  })

  it('6. full_kit CO → 4 URLs + doc2_type=notice_of_intent', async () => {
    rlsCaseRow   = { id: 'case-co', user_id: 'user-1', status: 'documents_ready', state_code: 'CO', kit_variant: 'full_kit', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { ...rlsCaseRow }
    const res = await GET(mkReq(), mkParams('case-co'))
    const body = await res.json()
    expect(body.doc2_type).toBe('notice_of_intent')
    expect(body.is_full_kit).toBe(true)
    expect(body.instruction_packet).toBeTruthy()
    expect(body.demand_letter).toBeTruthy()
    expect(body.doc2).toBeTruthy()
    expect(body.lien).toBeTruthy()
  })

  it('7. full_kit TX → 4 URLs + doc2_type=pre_lien_notice', async () => {
    rlsCaseRow   = { id: 'case-tx', user_id: 'user-1', status: 'documents_ready', state_code: 'TX', kit_variant: 'full_kit', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { ...rlsCaseRow }
    const res = await GET(mkReq(), mkParams('case-tx'))
    const body = await res.json()
    expect(body.doc2_type).toBe('pre_lien_notice')
    expect(body.is_full_kit).toBe(true)
    expect(body.lien).toBeTruthy()
  })

  it('8. demand_only TX → 2 URLs, doc2+lien null', async () => {
    rlsCaseRow   = { id: 'case-tx-do', user_id: 'user-1', status: 'documents_ready', state_code: 'TX', kit_variant: 'demand_only', documents_generated_at: new Date().toISOString(), download_count: 0, first_downloaded_at: null }
    adminCaseRow = { ...rlsCaseRow }
    const res = await GET(mkReq(), mkParams('case-tx-do'))
    const body = await res.json()
    expect(body.is_full_kit).toBe(false)
    expect(body.instruction_packet).toBeTruthy()
    expect(body.demand_letter).toBeTruthy()
    expect(body.doc2).toBeNull()
    expect(body.lien).toBeNull()
  })
})
