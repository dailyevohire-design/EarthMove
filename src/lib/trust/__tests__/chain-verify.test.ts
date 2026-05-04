import { describe, it, expect } from 'vitest';
import { computeChainHash } from '../chain-verify';

/**
 * Test vectors locked via MCP against production SQL function
 * compute_trust_evidence_chain_hash on 2026-05-04. If these fail, the TS
 * port has drifted from the SQL recipe and every chain in production will
 * return verified:false on the public verify endpoint.
 *
 * Recipe: sha256(COALESCE(prev,'') || '|' || COALESCE(sha,'no_raw') || '|' ||
 *         seq::text || '|' || job_id::text || '|' || finding_type)
 */
describe('computeChainHash', () => {
  it('matches SQL for first row in chain (no prev_hash)', () => {
    expect(computeChainHash({
      prev_hash: null,
      response_sha256: 'a'.repeat(64),
      sequence_number: 1,
      job_id: '00000000-0000-0000-0000-000000000001',
      finding_type: 'business_active',
    })).toBe('6c9ce8f17049abdd01b493592e34364b8f979cef1a0324903645416c091e97ab');
  });

  it('matches SQL for chained row with null response_sha256 (no_raw fallback)', () => {
    expect(computeChainHash({
      prev_hash: 'b'.repeat(64),
      response_sha256: null,
      sequence_number: 2,
      job_id: '00000000-0000-0000-0000-000000000001',
      finding_type: 'license_active',
    })).toBe('f8a1979d020ffa109f5c0d20ae5f0ebc2ca8f641a512bf8337fd7a1deeb811ea');
  });

  it('matches SQL for deep chain row', () => {
    expect(computeChainHash({
      prev_hash: 'c'.repeat(64),
      response_sha256: 'd'.repeat(64),
      sequence_number: 5,
      job_id: '11111111-2222-3333-4444-555555555555',
      finding_type: 'osha_no_violations',
    })).toBe('0a9313157388ac91aa66c6875b8f49648488dda2553d190f782716f6518e1cf7');
  });

  it('is deterministic across calls', () => {
    const args = {
      prev_hash: 'c'.repeat(64),
      response_sha256: 'd'.repeat(64),
      sequence_number: 5,
      job_id: '11111111-2222-3333-4444-555555555555',
      finding_type: 'osha_no_violations',
    };
    expect(computeChainHash(args)).toBe(computeChainHash(args));
  });
});
