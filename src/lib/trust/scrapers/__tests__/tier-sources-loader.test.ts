import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sourcesForTier, clearSourcesForTierCache } from '../tier-sources-loader'

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'

const ALL_ROWS = [
  { source_key: 'co_sos_biz', applicable_state_codes: ['CO'] },
  { source_key: 'co_dora', applicable_state_codes: ['CO'] },
  { source_key: 'denver_pim', applicable_state_codes: ['CO'] },
  { source_key: 'tx_sos_biz', applicable_state_codes: ['TX'] },
  { source_key: 'tx_tdlr', applicable_state_codes: ['TX'] },
  { source_key: 'dallas_open_data', applicable_state_codes: ['TX'] },
  { source_key: 'sam_gov_exclusions', applicable_state_codes: null },
]

function makeMockClient(rows: typeof ALL_ROWS, error: Error | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          contains: () => Promise.resolve({ data: error ? null : rows, error }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createAdminClient>
}

describe('sourcesForTier — state-code gating', () => {
  beforeEach(() => {
    clearSourcesForTierCache()
    vi.mocked(createAdminClient).mockReset()
  })

  it('returns CO sources + federal for stateCode=CO', async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeMockClient(ALL_ROWS))
    const result = await sourcesForTier('standard', 'CO')
    expect(result).toContain('co_sos_biz')
    expect(result).toContain('co_dora')
    expect(result).toContain('denver_pim')
    expect(result).toContain('sam_gov_exclusions')
    expect(result).not.toContain('tx_sos_biz')
    expect(result).not.toContain('tx_tdlr')
    expect(result).not.toContain('dallas_open_data')
  })

  it('returns TX sources + federal for stateCode=TX', async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeMockClient(ALL_ROWS))
    const result = await sourcesForTier('standard', 'TX')
    expect(result).toContain('tx_sos_biz')
    expect(result).toContain('tx_tdlr')
    expect(result).toContain('dallas_open_data')
    expect(result).toContain('sam_gov_exclusions')
    expect(result).not.toContain('co_sos_biz')
    expect(result).not.toContain('co_dora')
    expect(result).not.toContain('denver_pim')
  })

  it('treats null applicable_state_codes as all-states (federal)', async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeMockClient(ALL_ROWS))
    const co = await sourcesForTier('standard', 'CO')
    const tx = await sourcesForTier('standard', 'TX')
    expect(co).toContain('sam_gov_exclusions')
    expect(tx).toContain('sam_gov_exclusions')
  })

  it('returns only federal sources when stateCode is null', async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeMockClient(ALL_ROWS))
    const result = await sourcesForTier('standard', null)
    expect(result).toEqual(['sam_gov_exclusions'])
  })

  it('falls back to FALLBACK_BY_STATE when DB errors', async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeMockClient(ALL_ROWS, new Error('db down')))
    const result = await sourcesForTier('standard', 'CO')
    expect(result).toContain('co_sos_biz')
    expect(result).toContain('co_dora')
  })
})
