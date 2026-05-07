import { describe, expect, it } from 'vitest'
import { expandContractorNameVariants } from '../name-variants'

describe('expandContractorNameVariants', () => {
  // 1. Stem swaps + suffix permutations expand into the right variant set.
  it('expands "Bedrock excavation" with stem swap + suffix permutations', () => {
    const variants = expandContractorNameVariants('Bedrock excavation', 20)
    expect(variants).toContain('Bedrock excavation')
    expect(variants).toContain('Bedrock Excavation')
    // Stem swap (Excavation→Excavating). The replacement string is capitalized
    // because the regex matches case-insensitively but rewrites with the
    // uppercase form — see the stems table in name-variants.ts.
    expect(variants).toContain('Bedrock Excavating')
    expect(variants).toContain('Bedrock Excavation LLC')
    expect(variants).toContain('Bedrock Excavation Corp')
    expect(variants).toContain('Bedrock Excavation Inc')
  })

  // 2. Lowercase suffix is normalized away by stripCorporateSuffixes; suffix
  //    permutations rebuild the full set.
  it('strips lowercase llc + adds suffix permutations for "bedrock construction llc"', () => {
    const variants = expandContractorNameVariants('bedrock construction llc', 20)
    // Stripped form (no LLC) present
    expect(variants).toContain('bedrock construction')
    expect(variants).toContain('Bedrock Construction')
    // Suffix permutations rebuild — suffix loop checks \\bLLC\\b case-insensitive,
    // so 'llc' input is recognized as already-suffixed and LLC permutations
    // are skipped. Inc/Corp/Corporation permutations DO apply.
    expect(variants).toContain('Bedrock Construction Inc')
    expect(variants).toContain('Bedrock Construction Corp')
    // The exact-as-typed input is preserved at index 0
    expect(variants[0]).toBe('bedrock construction llc')
  })

  // 3. variant[0] is always the cleaned input verbatim — no auto-correct in
  //    this PR. Heavy fuzzy matching is post-launch.
  it('preserves typo at index 0 for "Judge dwf llc"', () => {
    const variants = expandContractorNameVariants('Judge dwf llc', 20)
    expect(variants[0]).toBe('Judge dwf llc')
  })

  // 4. Suffix permutations should only fire when the suffix isn't already in
  //    the input. "Construction" appears in this name, but "Construction" is
  //    not in the suffix loop set ([LLC|Inc|Corp|Corporation|Co]) so it never
  //    gets double-added. "Co" however is in the suffix loop — but matches
  //    \\bCo\\b only as a standalone token. Verifies the regex word-boundary
  //    isn't mistakenly matching inside "Construction" or "Constructors".
  it('does not double-add suffix tokens that are substrings of existing words', () => {
    const variants = expandContractorNameVariants('PCL Construction Services', 30)
    // No variant should contain a duplicated word like "Construction Construction"
    for (const v of variants) {
      expect(/\b(\w+)\s+\1\b/i.test(v)).toBe(false)
    }
    // "Co" suffix DOES get added because it isn't a standalone word in the
    // input. The variant ends with " Co", not buried inside "Construction".
    expect(variants).toContain('PCL Construction Services Co')
  })

  // 5. Empty input — defensive return path. Returns the literal raw input
  //    inside an array so callers don't NPE on .length.
  it('returns the literal empty input for ""', () => {
    expect(expandContractorNameVariants('')).toEqual([''])
  })

  // 6. Whitespace-only input collapses to empty after cleanup, so we hit the
  //    same defensive branch as test 5 — returns the raw whitespace input.
  it('returns the literal raw input for whitespace-only input', () => {
    expect(expandContractorNameVariants('   ')).toEqual(['   '])
  })

  // 7. Mixed-case input gets a clean title-cased copy; the function does not
  //    require well-formed input. Acronyms are sacrificed to title-case
  //    (PCL → Pcl) — this is acceptable for variant search since each scraper
  //    case-insensitive matches anyway.
  it('produces a clean title-cased variant for "BeMaS CoNsTrUcTiOn"', () => {
    const variants = expandContractorNameVariants('BeMaS CoNsTrUcTiOn', 20)
    expect(variants).toContain('Bemas Construction')
    expect(variants[0]).toBe('BeMaS CoNsTrUcTiOn')
  })

  // 8. limit parameter is honored exactly — slice is post-deduplication so
  //    the count is precise.
  it('honors the limit parameter exactly', () => {
    const variants = expandContractorNameVariants('Bedrock Excavation', 2)
    expect(variants).toHaveLength(2)
  })
})
