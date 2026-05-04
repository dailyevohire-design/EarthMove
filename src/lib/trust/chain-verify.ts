/**
 * TypeScript port of public.compute_trust_evidence_chain_hash for use in the
 * public chain verification API. SQL recipe (immutable, ground truth):
 *
 *   sha256( COALESCE(prev,'') || '|' ||
 *           COALESCE(response_sha256,'no_raw') || '|' ||
 *           sequence_number::text || '|' ||
 *           job_id::text || '|' ||
 *           finding_type )
 *
 * If this drifts from the SQL function, every chain in production becomes
 * "tamper-detected" on verify. Tested against real evidence rows in
 * src/lib/trust/__tests__/chain-verify.test.ts (must always pass).
 */

import { createHash } from 'node:crypto';

export interface EvidenceChainNode {
  id: string;
  job_id: string;
  sequence_number: number;
  finding_type: string;
  response_sha256: string | null;
  prev_hash: string | null;
  chain_hash: string;
}

export function computeChainHash(node: Pick<
  EvidenceChainNode,
  'prev_hash' | 'response_sha256' | 'sequence_number' | 'job_id' | 'finding_type'
>): string {
  const input = [
    node.prev_hash ?? '',
    node.response_sha256 ?? 'no_raw',
    String(node.sequence_number),
    node.job_id,
    node.finding_type,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}

export interface ChainVerificationResult {
  verified: boolean;
  evidence_count: number;
  mismatches: Array<{
    evidence_id: string;
    sequence_number: number;
    finding_type: string;
    expected_chain_hash: string;
    actual_chain_hash: string;
  }>;
}

/**
 * Verify a chain of evidence rows. Rows MUST be ordered by sequence_number ASC
 * within their job_id. Returns mismatches (empty array == verified).
 */
export function verifyChain(rows: EvidenceChainNode[]): ChainVerificationResult {
  const mismatches: ChainVerificationResult['mismatches'] = [];
  for (const row of rows) {
    const expected = computeChainHash(row);
    if (expected !== row.chain_hash) {
      mismatches.push({
        evidence_id: row.id,
        sequence_number: row.sequence_number,
        finding_type: row.finding_type,
        expected_chain_hash: expected,
        actual_chain_hash: row.chain_hash,
      });
    }
  }
  return {
    verified: mismatches.length === 0,
    evidence_count: rows.length,
    mismatches,
  };
}
