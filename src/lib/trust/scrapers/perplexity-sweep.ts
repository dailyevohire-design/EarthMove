/**
 * Perplexity Sonar open-web sweep — first half of the dual-engine layer
 * (patent claim 6). Posts a single grounded-research query to Perplexity,
 * parses the response into per-citation evidence rows classified as
 * adverse / positive by keyword rules.
 *
 * Cost: ~$0.005/sweep on sonar, ~$0.04 on sonar-pro. Free tier: 1 sweep.
 * Standard+: sweep + Claude verify fan-out (see claude-web-search.ts).
 *
 * Wraps the parent response as a single 'raw_source_response' evidence
 * row for chain integrity, then emits per-citation classified rows.
 */

import type { ScraperEvidence, TrustFindingType, TrustConfidence } from './types'

const ENDPOINT = 'https://api.perplexity.ai/chat/completions'
const SOURCE_KEY = 'perplexity_sweep'
const DEFAULT_MODEL: 'sonar' | 'sonar-pro' = 'sonar'
const DEFAULT_LOOKBACK_MONTHS = 12

const ADVERSE_KEYWORDS = [
  'lawsuit', 'sued', 'complaint', 'revoked', 'suspended', 'fined',
  'citation', 'fraud', 'scam', 'settlement', 'judgment', 'cease',
  'enforcement', 'violation', 'penalty', 'sanctioned', 'debarred',
  'indictment', 'criminal', 'investigation',
]
const POSITIVE_KEYWORDS = [
  'awarded', 'certified', 'accredited', 'recognized', 'top-rated',
  'partnership', 'milestone', 'expansion', 'completed',
]

export interface PerplexitySweepInput {
  legalName: string
  city?: string | null
  stateCode: string
  lookbackMonths?: number
  model?: 'sonar' | 'sonar-pro'
  fetchFn?: typeof fetch
  apiKey?: string
}

interface PerplexityCitation {
  url?: string
  title?: string
  published_date?: string
  snippet?: string
}

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>
  citations?: PerplexityCitation[] | string[]
}

function classifyClaim(text: string): { type: 'adverse' | 'positive' | 'neutral'; matched: string[] } {
  const lower = text.toLowerCase()
  const adverseMatches = ADVERSE_KEYWORDS.filter((k) => lower.includes(k))
  const positiveMatches = POSITIVE_KEYWORDS.filter((k) => lower.includes(k))
  if (adverseMatches.length > positiveMatches.length) {
    return { type: 'adverse', matched: adverseMatches }
  }
  if (positiveMatches.length > 0) {
    return { type: 'positive', matched: positiveMatches }
  }
  return { type: 'neutral', matched: [] }
}

function normalizeCitations(citations: PerplexityResponse['citations']): PerplexityCitation[] {
  if (!citations) return []
  if (typeof citations[0] === 'string') {
    return (citations as string[]).map((url) => ({ url }))
  }
  return citations as PerplexityCitation[]
}

export async function scrapePerplexitySweep(
  input: PerplexitySweepInput,
): Promise<ScraperEvidence[]> {
  const legalName = input.legalName?.trim()
  if (!legalName) throw new Error('scrapePerplexitySweep: legalName required')

  const apiKey = input.apiKey ?? process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return [errorEvidence(legalName, 'PERPLEXITY_API_KEY env var missing')]
  }

  const model = input.model ?? DEFAULT_MODEL
  const lookback = input.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS
  const cityClause = input.city && input.city.trim().length > 0
    ? `${input.city.trim()}, ${input.stateCode}`
    : input.stateCode
  const query =
    `Adverse enforcement actions, lawsuits, complaints, license revocations, ` +
    `OSHA citations, AG actions, scam allegations against "${legalName}" in ` +
    `${cityClause}, last ${lookback} months. Cite sources.`

  const fetchFn = input.fetchFn ?? fetch
  const start = Date.now()

  let resp: Response
  try {
    resp = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: query }],
        return_citations: true,
        search_recency_filter: 'month',
        max_tokens: 800,
      }),
    })
  } catch (err) {
    return [errorEvidence(legalName, `Perplexity network error: ${(err as Error)?.message}`)]
  }

  if (!resp.ok) {
    return [errorEvidence(legalName, `Perplexity HTTP ${resp.status}`)]
  }

  let body: PerplexityResponse
  try {
    body = (await resp.json()) as PerplexityResponse
  } catch {
    return [errorEvidence(legalName, 'Perplexity non-JSON response')]
  }

  const content = body.choices?.[0]?.message?.content ?? ''
  const citations = normalizeCitations(body.citations)
  const duration_ms = Date.now() - start

  const evidence: ScraperEvidence[] = []

  // Parent envelope row — preserves chain integrity and lets verifiers
  // re-fetch the full response without bloating per-citation rows.
  evidence.push({
    source_key: SOURCE_KEY,
    finding_type: 'raw_source_response',
    confidence: 'medium_llm' as TrustConfidence,
    finding_summary: `Perplexity ${model} sweep returned ${citations.length} citation${citations.length === 1 ? '' : 's'}`,
    extracted_facts: {
      query,
      model_used: model,
      sweep_query: query,
      response_text: content,
      citation_count: citations.length,
    },
    query_sent: query,
    response_sha256: null,
    response_snippet: content.slice(0, 1500),
    duration_ms,
    cost_cents: model === 'sonar-pro' ? 4 : 1,
  })

  // Per-citation classified rows. Use the title + snippet (or URL host as
  // fallback) to classify; absent context defaults to 'neutral' which is
  // dropped from emission to keep the chain dense.
  for (const c of citations) {
    if (!c.url) continue
    const context = `${c.title ?? ''} ${c.snippet ?? ''}`.trim()
    const classification = classifyClaim(context.length > 0 ? context : c.url)
    if (classification.type === 'neutral') continue

    const findingType: TrustFindingType =
      classification.type === 'adverse'
        ? 'open_web_adverse_signal'
        : 'open_web_positive_signal'

    evidence.push({
      source_key: SOURCE_KEY,
      finding_type: findingType,
      confidence: 'medium_llm' as TrustConfidence,
      finding_summary:
        classification.type === 'adverse'
          ? `Open-web adverse signal: ${c.title ?? c.url}`
          : `Open-web positive signal: ${c.title ?? c.url}`,
      extracted_facts: {
        citation_url: c.url,
        citation_title: c.title ?? null,
        citation_published_date: c.published_date ?? null,
        citation_snippet: c.snippet ?? null,
        classifier_keywords: classification.matched,
        sweep_query: query,
        model_used: model,
      },
      query_sent: c.url,
      response_sha256: null,
      response_snippet: (c.snippet ?? '').slice(0, 500) || null,
      duration_ms: 0,
      cost_cents: 0,
    })
  }

  return evidence
}

function errorEvidence(legalName: string, reason: string): ScraperEvidence {
  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error' as TrustFindingType,
    confidence: 'low_inference' as TrustConfidence,
    finding_summary: `Perplexity sweep failed for "${legalName}": ${reason}`,
    extracted_facts: { reason },
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  }
}
