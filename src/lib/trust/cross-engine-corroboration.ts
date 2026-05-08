/**
 * Cross-engine corroboration detector — patent claim 6.
 *
 * When Perplexity Sonar emits an adverse signal at URL X, AND Claude
 * web_search verifies that same URL (or a semantically-overlapping
 * citation), the corroboration is independent: two engines agree on
 * what the underlying public-record evidence says. This is materially
 * stronger than either engine's solo signal.
 *
 * Output: zero or more 'cross_engine_corroboration_event' evidence rows
 * carrying both engines' evidence_ids in extracted_facts. The orchestrator
 * persists these alongside the original Perplexity + Claude rows; the
 * builder projects them into rawReport.open_web.corroboration_events
 * AND uses the count to drive corroboration_depth + score adjustments.
 */

import type { ScraperEvidence, TrustConfidence } from './scrapers/types'
import { tokenJaccard } from './name-similarity'

const SOURCE_KEY = 'system_internal'
// Highest confidence available in the existing TrustConfidence union.
// Two-engine agreement is materially stronger than single-engine
// medium_llm; we map it to verified_structured.
const CORROBORATION_CONFIDENCE: TrustConfidence = 'verified_structured'
const SUMMARY_OVERLAP_THRESHOLD = 0.5

function urlHostPath(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const parsed = new URL(u)
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase()
  } catch {
    return null
  }
}

function getCitationUrl(e: ScraperEvidence): string | null {
  const facts = (e.extracted_facts ?? {}) as Record<string, unknown>
  const url = facts.citation_url ?? facts.bbb_search_url ?? facts.search_url
  return typeof url === 'string' ? url : null
}

function summaryOverlap(a: ScraperEvidence, b: ScraperEvidence): number {
  return tokenJaccard(a.finding_summary ?? '', b.finding_summary ?? '')
}

export interface DetectCorroborationInput {
  perplexityEvidence: Array<ScraperEvidence & { id?: string }>
  claudeVerifications: Array<ScraperEvidence & { id?: string }>
}

export function detectCrossEngineCorroboration(
  input: DetectCorroborationInput,
): ScraperEvidence[] {
  const events: ScraperEvidence[] = []
  const seen = new Set<string>() // dedupe by claude+perplexity pair

  for (const p of input.perplexityEvidence) {
    if (p.finding_type !== 'open_web_adverse_signal' && p.finding_type !== 'open_web_positive_signal') continue
    const pUrl = urlHostPath(getCitationUrl(p))

    for (const c of input.claudeVerifications) {
      // Verify-mode rows carry the verified flag in extracted_facts.verified.
      // Non-verifications (open_web_unverified or source_error) don't corroborate.
      if (c.finding_type !== 'open_web_verified' &&
          c.finding_type !== 'open_web_adverse_signal' &&
          c.finding_type !== 'open_web_positive_signal') continue

      const cUrl = urlHostPath(getCitationUrl(c))

      const urlMatch = pUrl !== null && cUrl !== null && pUrl === cUrl
      const overlap = urlMatch ? 1 : summaryOverlap(p, c)
      const semanticMatch = !urlMatch && overlap >= SUMMARY_OVERLAP_THRESHOLD

      if (!urlMatch && !semanticMatch) continue

      const key = `${p.id ?? p.finding_summary}::${c.id ?? c.finding_summary}`
      if (seen.has(key)) continue
      seen.add(key)

      events.push({
        source_key: SOURCE_KEY,
        finding_type: 'cross_engine_corroboration_event',
        confidence: CORROBORATION_CONFIDENCE,
        finding_summary:
          urlMatch
            ? `Cross-engine corroboration: Perplexity + Claude both cite ${pUrl}`
            : `Cross-engine corroboration: Perplexity + Claude semantically overlap (jaccard ${overlap.toFixed(2)})`,
        extracted_facts: {
          engines: ['perplexity_sweep', 'llm_web_search'],
          shared_citation_url: urlMatch ? getCitationUrl(p) : null,
          perplexity_evidence_id: p.id ?? null,
          claude_evidence_id: c.id ?? null,
          perplexity_summary: p.finding_summary,
          claude_summary: c.finding_summary,
          corroboration_method: urlMatch ? 'shared_url' : 'semantic_overlap',
          summary_overlap_score: overlap,
          claim_direction:
            p.finding_type === 'open_web_adverse_signal' ? 'adverse' : 'positive',
        },
        query_sent: null,
        response_sha256: null,
        response_snippet: null,
        duration_ms: 0,
        cost_cents: 0,
      })
    }
  }
  return events
}
