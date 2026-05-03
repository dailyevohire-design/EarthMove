import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import {
  loadTierSources,
  sourcesForTierAsync,
  _resetTierSourcesCache,
  _getHardcodedFallback,
} from '../tier-sources-loader';

function mockRegistryReturn(data: any | null, error: any | null = null) {
  fromMock.mockReturnValueOnce({
    select: vi.fn().mockResolvedValue({ data, error }),
  });
}

beforeEach(() => {
  _resetTierSourcesCache();
  fromMock.mockReset();
});

describe('tier-sources-loader', () => {
  it('standard tier returns the 5 implemented source_keys (alphabetical)', async () => {
    mockRegistryReturn([
      { source_key: 'sam_gov_exclusions', applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
      { source_key: 'co_sos_biz',         applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
      { source_key: 'tx_sos_biz',         applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
      { source_key: 'denver_pim',         applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
      { source_key: 'dallas_open_data',   applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
      { source_key: 'mock_source',        applicable_tiers: ['free'], is_active: false }, // inactive — skipped
    ]);
    const sources = await sourcesForTierAsync('standard');
    expect(sources).toEqual([
      'co_sos_biz', 'dallas_open_data', 'denver_pim', 'sam_gov_exclusions', 'tx_sos_biz',
    ]);
  });

  it('free tier returns mock_source only (when active)', async () => {
    mockRegistryReturn([
      { source_key: 'mock_source', applicable_tiers: ['free'], is_active: true },
      { source_key: 'co_sos_biz',  applicable_tiers: ['standard','plus','deep_dive','forensic'], is_active: true },
    ]);
    const sources = await sourcesForTierAsync('free');
    expect(sources).toEqual(['mock_source']);
  });

  it('skips sources with is_active=false even when tier matches', async () => {
    mockRegistryReturn([
      { source_key: 'mock_source', applicable_tiers: ['free'], is_active: false },
      { source_key: 'opencorporates', applicable_tiers: ['standard'], is_active: false },
    ]);
    const map = await loadTierSources();
    expect(map.free).toEqual([]);
    expect(map.standard).toEqual([]);
  });

  it('skips sources with empty applicable_tiers (declared-but-not-built)', async () => {
    mockRegistryReturn([
      { source_key: 'co_sos_biz',  applicable_tiers: ['standard'], is_active: true },
      { source_key: 'ny_sos_biz',  applicable_tiers: [],           is_active: true },
      { source_key: 'cslb_ca',     applicable_tiers: null,         is_active: true },
    ]);
    const sources = await sourcesForTierAsync('standard');
    expect(sources).toEqual(['co_sos_biz']);
  });

  it('falls back to hardcoded set on DB read error', async () => {
    mockRegistryReturn(null, { message: 'connection refused' });
    const sources = await sourcesForTierAsync('standard');
    expect(sources).toEqual(_getHardcodedFallback().standard);
  });

  it('caches first successful load (does not re-query on second call)', async () => {
    mockRegistryReturn([
      { source_key: 'co_sos_biz', applicable_tiers: ['standard'], is_active: true },
    ]);
    await sourcesForTierAsync('standard');
    await sourcesForTierAsync('standard'); // second call
    expect(fromMock).toHaveBeenCalledTimes(1); // only the first triggered a DB call
  });

  it('unknown tier falls back to standard', async () => {
    mockRegistryReturn([
      { source_key: 'co_sos_biz', applicable_tiers: ['standard'], is_active: true },
    ]);
    const sources = await sourcesForTierAsync('nonexistent_tier');
    expect(sources).toEqual(['co_sos_biz']); // = standard's set
  });
});
