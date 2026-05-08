/**
 * Pure name-similarity scoring for entity disambiguation.
 *
 * Used by the orchestrator candidate-search fallback (commit 2 of PR #27)
 * to rank registry rows against the user's typed name. Zero dependencies,
 * no IO, all functions deterministic.
 *
 * Scoring composition: 0.6 * tokenJaccard + 0.4 * normalizedLevenshtein.
 * The blend favors token-level overlap (cheap, robust to corp-suffix noise)
 * with edit-distance as a fallback for transposed/typo'd characters.
 */

const CORP_SUFFIX_RE =
  /\b(LLC|L\.L\.C\.?|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|LP|LLP|LLLP|PLLC|PC|P\.C\.|Ltd\.?|Limited)\b/gi

const PUNCT_RE = /[.,;:!?\-_/\\(){}[\]"']/g
const WS_RE = /\s+/g

export function normalizeForCompare(s: string | null | undefined): string {
  if (s == null) return ''
  return s
    .toLowerCase()
    .replace(CORP_SUFFIX_RE, ' ')
    .replace(PUNCT_RE, ' ')
    .replace(WS_RE, ' ')
    .trim()
}

function tokens(s: string): string[] {
  if (!s) return []
  return s.split(' ').filter((t) => t.length > 0)
}

const TOKEN_FUZZY_THRESHOLD = 0.7

/**
 * Fuzzy token Jaccard: a token in A matches a token in B if their
 * levenshteinNormalized score is >= 0.7. Captures one-char typos at
 * the token level (e.g. 'bedrok' ↔ 'bedrock'). Strict equality would
 * score 0 on typos, which is the wrong shape for a disambiguation
 * ranker — the whole point is to forgive typos.
 */
export function tokenJaccard(a: string, b: string): number {
  const A = tokens(normalizeForCompare(a))
  const B = tokens(normalizeForCompare(b))
  if (A.length === 0 && B.length === 0) return 0
  if (A.length === 0 || B.length === 0) return 0
  let matched = 0
  const usedB = new Set<number>()
  for (const ta of A) {
    let bestIdx = -1
    let bestScore = 0
    for (let j = 0; j < B.length; j++) {
      if (usedB.has(j)) continue
      const score = levenshteinNormalized(ta, B[j])
      if (score > bestScore) {
        bestScore = score
        bestIdx = j
      }
    }
    if (bestIdx >= 0 && bestScore >= TOKEN_FUZZY_THRESHOLD) {
      matched += 1
      usedB.add(bestIdx)
    }
  }
  // Jaccard on fuzzy-matched tokens: |A ∩ B| / |A ∪ B|
  const union = A.length + B.length - matched
  return union === 0 ? 0 : matched / union
}

/** Iterative Levenshtein DP, two-row rolling buffer. ~25 LOC. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

export function levenshteinNormalized(a: string, b: string): number {
  const an = normalizeForCompare(a)
  const bn = normalizeForCompare(b)
  if (an.length === 0 && bn.length === 0) return 0
  const maxLen = Math.max(an.length, bn.length)
  if (maxLen === 0) return 0
  return 1 - levenshtein(an, bn) / maxLen
}

export function nameSimilarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0
  const j = tokenJaccard(query, candidate)
  const l = levenshteinNormalized(query, candidate)
  return 0.6 * j + 0.4 * l
}

export interface RankCandidatesOpts {
  threshold?: number
  limit?: number
}

export function rankCandidates<T extends { entity_name: string }>(
  query: string,
  candidates: T[],
  opts: RankCandidatesOpts = {},
): Array<T & { similarity_score: number }> {
  if (!query || !Array.isArray(candidates) || candidates.length === 0) return []
  const threshold = opts.threshold ?? 0.55
  const limit = opts.limit ?? 5
  return candidates
    .map((c) => ({ ...c, similarity_score: nameSimilarity(query, c.entity_name) }))
    .filter((c) => c.similarity_score >= threshold)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit)
}
