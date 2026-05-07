/**
 * Pure name-variant expansion for contractor lookups.
 *
 * Heuristics (no fuzzy match, no Levenshtein, no DB roundtrips):
 *   - Whitespace cleanup
 *   - Title-cased copy
 *   - Suffix-stripped copy (LLC/Inc/Corp/Corporation/Co/Company/Ltd/LP/LLP)
 *   - Suffix-added permutations (LLC, Inc, Corp, Corporation)
 *   - Stem swaps for common contractor verbs/nouns
 *     (Excavation↔Excavating, Construction↔Constructors, Roofers↔Roofing, etc.)
 *   - Doubled-letter dedupe (typo guard: xxx → xx)
 *
 * Heavy fuzzy matching, Soundex, and persisted alias graphs are post-launch.
 *
 * Stable insertion order — variant[0] is always the cleaned literal input
 * so callers can return *_not_found findings for the user-typed name on a
 * total miss without inventing a variant.
 */

export function expandContractorNameVariants(input: string | null | undefined, limit = 5): string[] {
  // Defensive: callers reading off `any`-typed API responses may pass undefined
  // (e.g. dashboard's report.contractor_name when the route handler drops the
  // field). Return [] rather than throwing — caller's UI can render empty.
  if (input == null) return []
  const out = new Set<string>()
  const cleaned = input.trim().replace(/\s+/g, ' ')
  if (!cleaned) return [input]
  out.add(cleaned)
  out.add(toTitleCase(cleaned))

  const stripped = stripCorporateSuffixes(cleaned)
  if (stripped !== cleaned) out.add(stripped)
  out.add(toTitleCase(stripped))

  for (const suffix of ['LLC', 'Inc', 'Corp', 'Corporation', 'Co']) {
    if (!new RegExp(`\\b${suffix}\\b`, 'i').test(cleaned)) {
      out.add(`${stripped} ${suffix}`)
      out.add(`${toTitleCase(stripped)} ${suffix}`)
    }
  }

  const stems: Array<[RegExp, string]> = [
    [/\bExcavation\b/gi, 'Excavating'],
    [/\bExcavating\b/gi, 'Excavation'],
    [/\bExcavators\b/gi, 'Excavating'],
    [/\bConstruction\b/gi, 'Constructors'],
    [/\bContracting\b/gi, 'Contractors'],
    [/\bContractors\b/gi, 'Contracting'],
    [/\bRoofers\b/gi, 'Roofing'],
    [/\bPlumbers\b/gi, 'Plumbing'],
    [/\bBuilders\b/gi, 'Building'],
  ]
  for (const [pattern, replacement] of stems) {
    const v = cleaned.replace(pattern, replacement)
    if (v !== cleaned) out.add(v)
  }

  // Light typo dedupe — heavy fuzzy match is post-launch
  const dedoubled = cleaned.replace(/([a-z])\1{2,}/gi, '$1$1')
  if (dedoubled !== cleaned) out.add(dedoubled)

  return Array.from(out).slice(0, limit)
}

function stripCorporateSuffixes(s: string): string {
  return s
    .replace(/\b(LLC|Inc|Corp|Corporation|Co|Company|Ltd|LP|LLP)\.?\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}
