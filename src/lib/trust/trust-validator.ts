import { z } from 'zod'

export const TrustReportSchema = z.object({
  contractor_name:  z.string().min(1).max(300),
  location:         z.string().min(1).max(200),
  trust_score:      z.number().int().min(0).max(100),
  risk_level:       z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
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
}).strict()

export type TrustReport = z.infer<typeof TrustReportSchema>

export function parseReport(raw: string): { ok: true; data: TrustReport } | { ok: false; error: string } {
  try {
    let json = raw.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    const si = json.indexOf('{'), ei = json.lastIndexOf('}')
    if (si === -1 || ei === -1) throw new Error('No JSON found')
    json = json.slice(si, ei + 1)
    const parsed = JSON.parse(json)
    const result = TrustReportSchema.safeParse(parsed)
    if (!result.success) {
      // Salvage with defaults
      const s = salvage(parsed)
      const r2 = TrustReportSchema.safeParse(s)
      if (r2.success) return { ok: true, data: r2.data }
      return { ok: false, error: result.error.message }
    }
    return { ok: true, data: result.data }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

function salvage(p: any): any {
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
  return {
    contractor_name: p.contractor_name ?? 'Unknown',
    location: p.location ?? 'Unknown',
    trust_score: clamp(p.trust_score ?? 0, 0, 100),
    risk_level: ['LOW','MEDIUM','HIGH','CRITICAL'].includes(p.risk_level) ? p.risk_level : 'UNKNOWN',
    confidence_level: ['HIGH','MEDIUM','LOW'].includes(p.confidence_level) ? p.confidence_level : 'LOW',
    report_tier: p.report_tier ?? 'free',
    business_registration: p.business_registration ?? { status:'UNKNOWN', entity_type:null, formation_date:null, registered_agent:null, source:'' },
    licensing: p.licensing ?? { status:'UNKNOWN', license_number:null, expiration:null, source:'' },
    bbb_profile: p.bbb_profile ?? { rating:null, accredited:null, complaint_count:null, years_in_business:null, source:'' },
    reviews: p.reviews ?? { average_rating:null, total_reviews:null, sentiment:'INSUFFICIENT_DATA', sources:[] },
    legal_records: p.legal_records ?? { status:'UNKNOWN', findings:[], sources:[] },
    osha_violations: p.osha_violations ?? { status:'UNKNOWN', violation_count:null, serious_count:null, findings:[] },
    red_flags: p.red_flags ?? [],
    positive_indicators: p.positive_indicators ?? [],
    summary: p.summary ?? 'Verification data incomplete.',
    data_sources_searched: p.data_sources_searched ?? [],
    disclaimer: p.disclaimer ?? 'For informational purposes only.',
  }
}
