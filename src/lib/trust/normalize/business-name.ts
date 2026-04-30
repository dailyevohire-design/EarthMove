/**
 * normalizeBusinessName — TypeScript port of the SQL function
 *   public.normalize_contractor_name(p_name text)
 *
 * MUST stay in lockstep with the SQL function. The SQL function is the
 * authority because it powers the contractors_normalized_state_uniq index
 * via a generated normalized_name column. If TS and SQL diverge, scrapers
 * will create duplicate contractors rows that bypass dedup.
 *
 * Algorithm (mirrors PG REGEXP_REPLACE behavior, single-pass, non-greedy):
 *   1. trim() leading/trailing whitespace
 *   2. strip ONE trailing business suffix (case-insensitive) with optional
 *      leading comma and trailing period: /,?\s+(llc|inc|...|co)\.?\s*$/i
 *   3. collapse internal whitespace runs to single space (/\s+/g)
 *   4. lowercase
 *
 * Intentionally narrow. Does NOT strip diacritics, '&', 'The ', DBA/FKA, or
 * inner periods (so 'Acme Plumbing L.L.C.' stays 'acme plumbing l.l.c.').
 * That richer behavior is a paired SQL+TS upgrade for a later commit.
 */
const SUFFIX_RE = /,?\s+(llc|inc|incorporated|corp|corporation|ltd|limited|lp|llp|pllc|pa|pc|company|co)\.?\s*$/i;
const WHITESPACE_RE = /\s+/g;

export function normalizeBusinessName(input: string): string {
  if (input == null) return '';
  return input
    .trim()
    .replace(SUFFIX_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .toLowerCase();
}
