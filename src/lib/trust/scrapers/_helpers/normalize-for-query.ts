/**
 * Cross-source entity-name normalization for external SoQL/ArcGIS LIKE queries.
 *
 * Public-records portals (CO SOS, TX Comptroller, Denver PIM, Dallas Open Data,
 * SAM.gov, etc.) store contractor names with varying form. A user-supplied
 * `PLAZA CONSTRUCTION, INC.` may be stored as `PLAZA CONSTRUCTION` in one source
 * and `PLAZA CONSTRUCTION, INC.` in another. SoQL `LIKE '%input%'` only matches
 * if the input is a substring of the stored value, so we strip predictable
 * entity-form suffixes from the SEARCH TERM before query construction. The
 * stored value is never mutated — only the query side.
 *
 * Strip order matters: legacy markers first, then baked-in status suffixes,
 * then entity-form suffixes, then whitespace cleanup. End-anchored throughout
 * so mid-string `Inc Corp Holdings` is left alone.
 */

// ── Trailing legacy markers (CO SOS appends `>>` to legacy names) ────────────
const TRAILING_LEGACY_MARKER = /\s*>>?\s*$/;

// ── Trailing baked-in status suffix (CO SOS appends `, Delinquent <date>`) ───
const TRAILING_STATUS_SUFFIX =
  /,\s*(Delinquent|Dissolved|Voluntarily Dissolved|Forfeited|Withdrawn|Merged|Converted|Noncompliant)\b.*$/i;

// ── Trailing entity-form suffix ──────────────────────────────────────────────
//
// Order longer/dotted forms BEFORE shorter ones inside the alternation so the
// regex engine matches the most specific suffix first (e.g. `L.L.C.` before
// `LLC`, `L.L.P.` before `LLP`). The leading `[\s,]+` requires at least one
// space or comma boundary, so `Holdings` (no boundary token in the suffix list)
// is NOT stripped from `Acme Inc Corp Holdings`.
//
// Trailing `\.?\s*$` matches an optional final period plus end of string,
// which lets `Corp.` and `Corp` both strip cleanly.
const TRAILING_ENTITY_SUFFIX =
  /[\s,]+(?:L\.L\.C\.?|L\.L\.P\.?|L\.P\.?|P\.C\.?|PLLC|LLC|LLP|LP|PC|Corporation|Corp\.?|Incorporated|Inc\.?|Ltd\.?)\.?\s*$/i;

export function normalizeForExternalQuery(rawName: string): string {
  return rawName
    .trim()
    .replace(TRAILING_LEGACY_MARKER, '')
    .replace(TRAILING_STATUS_SUFFIX, '')
    .replace(TRAILING_ENTITY_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim();
}
