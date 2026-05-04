import { describe, it, expect } from 'vitest';
import { computeChainHash, verifyChain, type EvidenceChainNode } from '../chain-verify';

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

describe('verifyChain', () => {
  // Build a clean 3-row synthetic chain. Each chain_hash field is computed from
  // the row's actual inputs, so verifyChain should return verified:true.
  function buildCleanChain(): EvidenceChainNode[] {
    const jobId = '22222222-3333-4444-5555-666666666666';
    const row1Hash = computeChainHash({
      prev_hash: null,
      response_sha256: 'a'.repeat(64),
      sequence_number: 1,
      job_id: jobId,
      finding_type: 'business_active',
    });
    const row2Hash = computeChainHash({
      prev_hash: row1Hash,
      response_sha256: 'b'.repeat(64),
      sequence_number: 2,
      job_id: jobId,
      finding_type: 'license_active',
    });
    const row3Hash = computeChainHash({
      prev_hash: row2Hash,
      response_sha256: 'c'.repeat(64),
      sequence_number: 3,
      job_id: jobId,
      finding_type: 'osha_no_violations',
    });
    return [
      { id: 'row-1-uuid', job_id: jobId, sequence_number: 1, finding_type: 'business_active',    response_sha256: 'a'.repeat(64), prev_hash: null,     chain_hash: row1Hash },
      { id: 'row-2-uuid', job_id: jobId, sequence_number: 2, finding_type: 'license_active',     response_sha256: 'b'.repeat(64), prev_hash: row1Hash, chain_hash: row2Hash },
      { id: 'row-3-uuid', job_id: jobId, sequence_number: 3, finding_type: 'osha_no_violations', response_sha256: 'c'.repeat(64), prev_hash: row2Hash, chain_hash: row3Hash },
    ];
  }

  it('returns verified=true on a clean chain', () => {
    const result = verifyChain(buildCleanChain());
    expect(result.verified).toBe(true);
    expect(result.evidence_count).toBe(3);
    expect(result.mismatches).toEqual([]);
  });

  it('detects tampered chain_hash on a single row', () => {
    const chain = buildCleanChain();
    // Tamper row 2's stored chain_hash by flipping one hex char
    const original = chain[1].chain_hash;
    chain[1].chain_hash = (original[0] === 'f' ? '0' : 'f') + original.slice(1);

    const result = verifyChain(chain);
    expect(result.verified).toBe(false);
    expect(result.evidence_count).toBe(3);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].evidence_id).toBe('row-2-uuid');
    expect(result.mismatches[0].sequence_number).toBe(2);
    expect(result.mismatches[0].finding_type).toBe('license_active');
    expect(result.mismatches[0].actual_chain_hash).toBe(chain[1].chain_hash);
    expect(result.mismatches[0].expected_chain_hash).toBe(original);
  });

  it('detects tampered finding_type on a single row', () => {
    const chain = buildCleanChain();
    // Tamper row 1's finding_type — chain_hash should now mismatch the recompute
    chain[0].finding_type = 'business_dissolved';

    const result = verifyChain(chain);
    expect(result.verified).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].evidence_id).toBe('row-1-uuid');
  });

  it('reports all mismatches when multiple rows are tampered', () => {
    const chain = buildCleanChain();
    chain[0].chain_hash = '0'.repeat(64);
    chain[2].response_sha256 = 'X'.repeat(64);

    const result = verifyChain(chain);
    expect(result.verified).toBe(false);
    expect(result.mismatches).toHaveLength(2);
    const mismatchedIds = result.mismatches.map(m => m.evidence_id).sort();
    expect(mismatchedIds).toEqual(['row-1-uuid', 'row-3-uuid']);
  });

  it('returns verified=true for empty chain', () => {
    const result = verifyChain([]);
    expect(result.verified).toBe(true);
    expect(result.evidence_count).toBe(0);
    expect(result.mismatches).toEqual([]);
  });
});
