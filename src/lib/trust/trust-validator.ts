import { z } from 'zod'

// FCRA / entity-only gate. Same regex used inline in /api/trust/route.ts, now
// exported so callers that open paid Stripe sessions (/api/trust/checkout) can
// reject natural-person queries before any money moves. See commit deb9bf4
// for rationale (P0-7).
const ENTITY_SUFFIX_RE =
  /\b(LLC|L\.L\.C\.?|INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|CO\.?|COMPANY|GROUP|HOLDINGS|ENTERPRISES|LP|LLP|PLLC|PC|P\.C\.|ASSOCIATES|PARTNERS|SOLUTIONS|SERVICES|CONSTRUCTION|CONTRACTING|BUILDERS|EXCAVATION|GRADING|HAULING|MATERIALS|AGGREGATES)\b/i

export class EntityOnlyError extends Error {
  constructor(public readonly contractorName: string) {
    super('entity_only')
    this.name = 'EntityOnlyError'
  }
}

export function isEntityName(name: string): boolean {
  if (typeof name !== 'string') return false
  const cleaned = name.replace(/[.,]/g, ' ')
  return ENTITY_SUFFIX_RE.test(cleaned)
}

export function assertEntityOnly(name: string): void {
  if (!isEntityName(name)) throw new EntityOnlyError(name)
}

export const TrustReportSchema = z.object({
  contractor_name:  z.string().min(1).max(300),
  location:         z.string().min(1).max(200),
  trust_score:      z.number().int().min(0).max(100).nullable(),
  risk_level:       z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'AMBIGUOUS']).nullable(),
  confidence_level: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  report_tier:      z.enum(['free', 'pro', 'enterprise']),
  business_registration: z.object({
    status:           z.enum(['VERIFIED', 'NOT_FOUND', 'INACTIVE', 'UNKNOWN']),
    entity_type:      z.string().max(100).nullable(),
    formation_date:   z.string().max(50).nullable(),
    registered_agent: z.string().max(200).nullable(),
    source:           z.string().max(500),
  }),
  licensing: z.object({
    status:         z.enum(['VERIFIED', 'NOT_FOUND', 'EXPIRED', 'UNKNOWN']),
    license_number: z.string().max(100).nullable(),
    expiration:     z.string().max(50).nullable(),
    source:         z.string().max(500),
  }),
  bbb_profile: z.object({
    rating:            z.enum(['A+', 'A', 'B', 'C', 'D', 'F', 'NR']).nullable(),
    accredited:        z.boolean().nullable(),
    complaint_count:   z.number().int().min(0).nullable(),
    years_in_business: z.number().int().min(0).nullable(),
    source:            z.string().max(500),
  }),
  reviews: z.object({
    average_rating: z.number().min(0).max(5).nullable(),
    total_reviews:  z.number().int().min(0).nullable(),
    sentiment:      z.enum(['POSITIVE', 'MIXED', 'NEGATIVE', 'INSUFFICIENT_DATA']),
    sources:        z.array(z.string().max(300)).max(10),
  }),
  legal_records: z.object({
    status:   z.enum(['CLEAN', 'ISSUES_FOUND', 'UNKNOWN']),
    findings: z.array(z.string().max(500)).max(20),
    sources:  z.array(z.string().max(300)).max(10),
  }),
  osha_violations: z.object({
    status:          z.enum(['CLEAN', 'VIOLATIONS_FOUND', 'UNKNOWN']),
    violation_count: z.number().int().min(0).nullable(),
    serious_count:   z.number().int().min(0).nullable(),
    findings:        z.array(z.string().max(500)).max(20),
  }),
  red_flags:             z.array(z.string().max(500)).max(20),
  positive_indicators:   z.array(z.string().max(500)).max(20),
  summary:               z.string().max(2000),
  data_sources_searched: z.array(z.string().max(500)).max(30),
  disclaimer:            z.string().max(1000),
  ambiguous_candidates:  z.array(z.object({
    name:                z.string().max(300),
    entity_id:           z.string().max(100).nullable(),
    address:             z.string().max(300).nullable(),
    principal:           z.string().max(200).nullable(),
    formation_year:      z.number().int().nullable(),
    distinguishing_note: z.string().max(500),
  })).max(10).nullable().default(null),
}).strict()

export type TrustReport = z.infer<typeof TrustReportSchema>

// ---------- Normalizer helpers ----------

function truncString(s: unknown, max: number): string {
  if (typeof s !== 'string') return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function truncStringOrNull(s: unknown, max: number): string | null {
  if (s == null || typeof s !== 'string' || s.length === 0) return null
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function intOrNull(n: unknown): number | null {
  if (n == null) return null
  const v = Number(n)
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

function truncArrayString(arr: unknown, maxLen: number, maxStr: number): string[] {
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const item of arr) {
    if (typeof item === 'string' && item.length > 0) {
      out.push(item.length > maxStr ? item.slice(0, maxStr - 1) + '…' : item)
      if (out.length >= maxLen) break
    }
  }
  return out
}

function pickEnum<T extends string>(
  v: unknown,
  options: readonly T[],
  fallback: T,
  aliases: Record<string, T> = {},
): T {
  if (typeof v !== 'string') return fallback
  if (options.includes(v as T)) return v as T
  const up = v.toUpperCase().replace(/[-\s]+/g, '_')
  if (options.includes(up as T)) return up as T
  return aliases[v] ?? aliases[up] ?? fallback
}

function pickEnumOrNull<T extends string>(
  v: unknown,
  options: readonly T[],
  aliases: Record<string, T> = {},
): T | null {
  if (v == null || typeof v !== 'string') return null
  if (options.includes(v as T)) return v as T
  const up = v.toUpperCase().replace(/[-\s]+/g, '_')
  if (options.includes(up as T)) return up as T
  return aliases[v] ?? aliases[up] ?? null
}

// ---------- Alias tables for enum values Claude emits in non-canonical form ----------

const BBB_ALIASES: Record<string, 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | 'NR'> = {
  'A_PLUS':    'A+',
  'NOT_RATED': 'NR',
  'N/A':       'NR',
  'NONE':      'NR',
  'UNRATED':   'NR',
}

const LEGAL_ALIASES: Record<string, 'CLEAN' | 'ISSUES_FOUND' | 'UNKNOWN'> = {
  'NO_ISSUES':          'CLEAN',
  'NONE_FOUND':         'CLEAN',
  'NO_RECORDS':         'CLEAN',
  'ISSUES':             'ISSUES_FOUND',
  'MINOR_ISSUES_NOTED': 'ISSUES_FOUND',
  'MAJOR_ISSUES':       'ISSUES_FOUND',
  'FOUND':              'ISSUES_FOUND',
  'LITIGATION':         'ISSUES_FOUND',
}

const OSHA_ALIASES: Record<string, 'CLEAN' | 'VIOLATIONS_FOUND' | 'UNKNOWN'> = {
  'NO_VIOLATIONS': 'CLEAN',
  'VIOLATIONS':    'VIOLATIONS_FOUND',
  'FOUND':         'VIOLATIONS_FOUND',
}

// ---------- Normalizer ----------

function normalizeCandidates(arr: unknown): Array<{
  name: string
  entity_id: string | null
  address: string | null
  principal: string | null
  formation_year: number | null
  distinguishing_note: string
}> | null {
  if (arr == null) return null
  if (!Array.isArray(arr)) return null
  const out = []
  for (const raw of arr.slice(0, 10)) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as Record<string, unknown>
    const name = truncString(c.name, 300)
    if (!name) continue
    out.push({
      name,
      entity_id:           truncStringOrNull(c.entity_id, 100),
      address:             truncStringOrNull(c.address, 300),
      principal:           truncStringOrNull(c.principal, 200),
      formation_year:      intOrNull(c.formation_year),
      distinguishing_note: truncString(c.distinguishing_note, 500),
    })
  }
  return out.length ? out : null
}

function normalizeReport(p: any): any {
  if (!p || typeof p !== 'object') p = {}

  return {
    contractor_name:  truncString(p.contractor_name, 300) || 'Unknown',
    location:         truncString(p.location, 200) || 'Unknown',
    trust_score:      p.trust_score == null ? null : Math.round(clampNum(p.trust_score, 0, 100, 0)),
    risk_level:       p.risk_level == null ? null : pickEnum(p.risk_level, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'AMBIGUOUS'] as const, 'MEDIUM'),
    confidence_level: pickEnum(p.confidence_level, ['HIGH', 'MEDIUM', 'LOW'] as const, 'LOW'),
    report_tier:      pickEnum(p.report_tier, ['free', 'pro', 'enterprise'] as const, 'free'),
    business_registration: {
      status:           pickEnum(p.business_registration?.status, ['VERIFIED', 'NOT_FOUND', 'INACTIVE', 'UNKNOWN'] as const, 'UNKNOWN'),
      entity_type:      truncStringOrNull(p.business_registration?.entity_type, 100),
      formation_date:   truncStringOrNull(p.business_registration?.formation_date, 50),
      registered_agent: truncStringOrNull(p.business_registration?.registered_agent, 200),
      source:           truncString(p.business_registration?.source, 500),
    },
    licensing: {
      status:         pickEnum(p.licensing?.status, ['VERIFIED', 'NOT_FOUND', 'EXPIRED', 'UNKNOWN'] as const, 'UNKNOWN'),
      license_number: truncStringOrNull(p.licensing?.license_number, 100),
      expiration:     truncStringOrNull(p.licensing?.expiration, 50),
      source:         truncString(p.licensing?.source, 500),
    },
    bbb_profile: {
      rating:            pickEnumOrNull(p.bbb_profile?.rating, ['A+', 'A', 'B', 'C', 'D', 'F', 'NR'] as const, BBB_ALIASES),
      accredited:        typeof p.bbb_profile?.accredited === 'boolean' ? p.bbb_profile.accredited : null,
      complaint_count:   intOrNull(p.bbb_profile?.complaint_count),
      years_in_business: intOrNull(p.bbb_profile?.years_in_business),
      source:            truncString(p.bbb_profile?.source, 500),
    },
    reviews: {
      average_rating: p.reviews?.average_rating == null ? null : clampNum(p.reviews.average_rating, 0, 5, 0),
      total_reviews:  intOrNull(p.reviews?.total_reviews),
      sentiment:      pickEnum(p.reviews?.sentiment, ['POSITIVE', 'MIXED', 'NEGATIVE', 'INSUFFICIENT_DATA'] as const, 'INSUFFICIENT_DATA'),
      sources:        truncArrayString(p.reviews?.sources, 10, 300),
    },
    legal_records: {
      status:   pickEnum(p.legal_records?.status, ['CLEAN', 'ISSUES_FOUND', 'UNKNOWN'] as const, 'UNKNOWN', LEGAL_ALIASES),
      findings: truncArrayString(p.legal_records?.findings, 20, 500),
      sources:  truncArrayString(p.legal_records?.sources, 10, 300),
    },
    osha_violations: {
      status:          pickEnum(p.osha_violations?.status, ['CLEAN', 'VIOLATIONS_FOUND', 'UNKNOWN'] as const, 'UNKNOWN', OSHA_ALIASES),
      violation_count: intOrNull(p.osha_violations?.violation_count),
      serious_count:   intOrNull(p.osha_violations?.serious_count),
      findings:        truncArrayString(p.osha_violations?.findings, 20, 500),
    },
    red_flags:             truncArrayString(p.red_flags, 20, 500),
    positive_indicators:   truncArrayString(p.positive_indicators, 20, 500),
    summary:               truncString(p.summary, 2000) || 'Verification data incomplete.',
    data_sources_searched: truncArrayString(p.data_sources_searched, 30, 500),
    disclaimer:            truncString(p.disclaimer, 1000) || 'For informational purposes only.',
    ambiguous_candidates:  normalizeCandidates(p.ambiguous_candidates),
  }
}

// ---------- Entry point ----------

// ---------- PII scrubber (P1-12) ----------
//
// Last-line defense against the model emitting SSN / DOB / driver's-license
// numbers into a persisted report. Prompts instruct the model to strip PII,
// but a single prompt-injection bypass would otherwise land PII in
// trust_reports.raw_report (JSONB) and propagate to shared views.
//
// Regexes use .match() / .replace() (no .test() with /g — that carries
// lastIndex state across the same string and silently mis-detects).

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g
const DOB_RE = /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g
const DL_RE  = /\b[A-Z]\d{7,8}\b/g

type Scrubbable = string | number | boolean | null | undefined | Scrubbable[] | { [k: string]: Scrubbable }

export function scrubPIIFromReport(report: TrustReport): { scrubbed: TrustReport; hits: string[] } {
  const hits = new Set<string>()

  const walk = (v: Scrubbable): Scrubbable => {
    if (typeof v === 'string') {
      let out = v
      if (out.match(SSN_RE)) { hits.add('ssn');             out = out.replace(SSN_RE, '[REDACTED_SSN]') }
      if (out.match(DOB_RE)) { hits.add('dob');             out = out.replace(DOB_RE, '[REDACTED_DOB]') }
      if (out.match(DL_RE))  { hits.add('drivers_license'); out = out.replace(DL_RE,  '[REDACTED_DL]')  }
      return out
    }
    if (Array.isArray(v)) return v.map(walk) as Scrubbable[]
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, Scrubbable>).map(([k, val]) => [k, walk(val)])
      ) as Scrubbable
    }
    return v
  }

  const scrubbed = walk(report as unknown as Scrubbable) as unknown as TrustReport
  return { scrubbed, hits: Array.from(hits) }
}

/**
 * Extract the first complete top-level JSON object by walking brace depth,
 * respecting string literals and escape sequences. Returns null if no
 * balanced object is found.
 *
 * Replaces a previous slice-from-first-{-to-last-} approach that broke when
 * the model emitted trailing prose after the report. The system prompt asks
 * for raw JSON only, but the model occasionally appends a comment or
 * explanation. The old slice would include that prose, and JSON.parse would
 * throw "Unexpected non-whitespace character after JSON at position N" —
 * causing a free-tier "Report validation failed" 500 to the user.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export function parseReport(raw: string): { ok: true; data: TrustReport } | { ok: false; error: string } {
  try {
    const cleaned = raw.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    const json = extractFirstJsonObject(cleaned)
    if (!json) throw new Error('No balanced JSON object found in model response')
    const parsed = JSON.parse(json)
    const normalized = normalizeReport(parsed)
    const result = TrustReportSchema.safeParse(normalized)
    if (!result.success) return { ok: false, error: result.error.message }
    return { ok: true, data: result.data }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
