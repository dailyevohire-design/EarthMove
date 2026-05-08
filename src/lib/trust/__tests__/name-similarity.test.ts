import { describe, expect, it } from 'vitest'
import {
  normalizeForCompare,
  tokenJaccard,
  levenshteinNormalized,
  nameSimilarity,
  rankCandidates,
} from '../name-similarity'

describe('normalizeForCompare', () => {
  it('strips corporate suffixes + lowercases + collapses ws', () => {
    expect(normalizeForCompare('BEDROCK EXCAVATING CORP.')).toBe('bedrock excavating')
    expect(normalizeForCompare('Acme Plumbing, LLC')).toBe('acme plumbing')
    expect(normalizeForCompare('  Multi   Space  Inc  ')).toBe('multi space')
  })

  it('returns empty for null/undefined', () => {
    expect(normalizeForCompare(null)).toBe('')
    expect(normalizeForCompare(undefined)).toBe('')
  })
})

describe('nameSimilarity', () => {
  // 1. Typo input still passes the 0.55 threshold against a clean SOS hit.
  it('"Bedrok Excavtin" vs "BEDROCK EXCAVATING CORP." scores >= 0.55', () => {
    expect(nameSimilarity('Bedrok Excavtin', 'BEDROCK EXCAVATING CORP.')).toBeGreaterThanOrEqual(0.55)
  })

  // 2. Clean input with only a corp-suffix difference scores high.
  it('"Bedrock Excavating" vs "BEDROCK EXCAVATING CORP." scores >= 0.85', () => {
    expect(nameSimilarity('Bedrock Excavating', 'BEDROCK EXCAVATING CORP.')).toBeGreaterThanOrEqual(0.85)
  })

  // 3. Unrelated names score low — rules out false positives.
  it('"Acme Plumbing" vs "BEDROCK EXCAVATING CORP." scores < 0.30', () => {
    expect(nameSimilarity('Acme Plumbing', 'BEDROCK EXCAVATING CORP.')).toBeLessThan(0.30)
  })

  // 4. Defensive null/empty inputs.
  it('returns 0 for empty/null inputs', () => {
    expect(nameSimilarity('', 'BEDROCK')).toBe(0)
    expect(nameSimilarity('BEDROCK', '')).toBe(0)
  })

  // 5. Identity case — same string scores 1.0 (intersection==union, edit distance 0).
  it('identical strings score 1.0', () => {
    expect(nameSimilarity('Bedrock Excavating', 'Bedrock Excavating')).toBe(1)
  })
})

describe('tokenJaccard', () => {
  it('overlapping tokens after normalization', () => {
    expect(tokenJaccard('Bedrock Excavating LLC', 'Bedrock Excavating Corp')).toBe(1)
  })

  it('zero overlap returns 0', () => {
    expect(tokenJaccard('apple banana', 'orange grape')).toBe(0)
  })
})

describe('levenshteinNormalized', () => {
  it('one-char typo on short string still scores high after normalization', () => {
    expect(levenshteinNormalized('Bedrock', 'Bedrok')).toBeGreaterThan(0.85)
  })
})

describe('rankCandidates', () => {
  // 6. Empty input handling.
  it('returns [] for empty query or empty candidates', () => {
    expect(rankCandidates('', [{ entity_name: 'Foo' }])).toEqual([])
    expect(rankCandidates('Foo', [])).toEqual([])
  })

  // 7. Sorted desc + capped at limit + drops below threshold.
  it('sorts desc, caps at limit, drops below threshold', () => {
    const candidates = [
      { entity_name: 'BEDROCK EXCAVATING CORP.', entity_id: '1' },
      { entity_name: 'BEDROCK EXCAVATION LLC', entity_id: '2' },
      { entity_name: 'Acme Plumbing Inc', entity_id: '3' },
      { entity_name: 'Bedrock Construction Inc', entity_id: '4' },
      { entity_name: 'Stone Excavating Co', entity_id: '5' },
      { entity_name: 'Totally Unrelated Tacos LLC', entity_id: '6' },
    ]
    const ranked = rankCandidates('Bedrock Excavating', candidates, { threshold: 0.55, limit: 3 })
    expect(ranked.length).toBeLessThanOrEqual(3)
    // First two should be the BEDROCK EXCAVATING variants
    expect(ranked[0].entity_name.toUpperCase()).toContain('BEDROCK')
    expect(ranked[0].similarity_score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].similarity_score)
    // Below-threshold entries excluded
    expect(ranked.find((c) => c.entity_id === '6')).toBeUndefined()
  })

  // 8. Default opts threshold 0.55, limit 5.
  it('honors default threshold 0.55 and limit 5', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      entity_name: `Bedrock Excavating ${i}`,
      entity_id: String(i),
    }))
    const ranked = rankCandidates('Bedrock Excavating', candidates)
    expect(ranked.length).toBeLessThanOrEqual(5)
    expect(ranked.every((c) => c.similarity_score >= 0.55)).toBe(true)
  })
})
