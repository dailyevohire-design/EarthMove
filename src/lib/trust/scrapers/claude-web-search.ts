/**
 * Claude web_search scraper — second half of the dual-engine open-web
 * layer (patent claim 6).
 *
 * Two modes:
 *   1. VERIFY — fan-out from a Perplexity hit. Given a claim + citation_url,
 *      fetch + read the page and decide whether the claim is supported.
 *   2. TARGETED — independent queries on standard+ tier. Claude does its
 *      own web_search to investigate; emits per-finding evidence rows.
 *
 * Both wrap try/catch and emit a single source_error row on failure.
 *
 * Requires ANTHROPIC_API_KEY at runtime. The Anthropic SDK + web_search
 * tool support are already proven in the existing trust codebase
 * (synthesize-v2-prompt, anthropic-watchdog).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ScraperEvidence, TrustFindingType, TrustConfidence } from './types'

const SOURCE_KEY = 'llm_web_search'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_VERIFY_MAX_USES = 2
const DEFAULT_TARGETED_MAX_USES = 5

// Spelled out so we don't import shape from anthropic-watchdog (would
// drag in unrelated deps).
type WebSearchTool = {
  type: 'web_search_20250305'
  name: 'web_search'
  max_uses: number
  user_location?: { type: 'approximate'; city?: string; region?: string; country?: string }
}

type AnthropicClientLike = Pick<Anthropic, 'messages'>

export interface ClaudeWebSearchVerifyInput {
  claim: string
  citationUrl: string
  contractorName: string
  client?: AnthropicClientLike
  apiKey?: string
  model?: string
}

export interface ClaudeWebSearchTargetedInput {
  legalName: string
  city?: string | null
  stateCode: string
  query: string
  client?: AnthropicClientLike
  apiKey?: string
  model?: string
  userLocation?: { city?: string; region?: string }
}

interface VerifyResult {
  verified: boolean
  confidence: 'high' | 'medium' | 'low'
  supporting_quote?: string | null
  contradicting_evidence?: string | null
  source_type?: string | null
}

interface TargetedFinding {
  claim: string
  citation_url: string
  claim_type: 'adverse' | 'positive' | 'neutral'
  confidence: 'high' | 'medium' | 'low'
}

interface TargetedResult {
  findings: TargetedFinding[]
}

function tryParseJson<T>(text: string): T | null {
  // Anthropic responses sometimes include prose around the JSON; try strict
  // parse first, then a permissive {...} extraction.
  try { return JSON.parse(text) as T } catch { /* fall through */ }
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}

function confidenceToScraperConfidence(c: 'high' | 'medium' | 'low'): TrustConfidence {
  if (c === 'high') return 'high_llm'
  if (c === 'medium') return 'medium_llm'
  return 'low_inference'
}

function getClient(input: { client?: AnthropicClientLike; apiKey?: string }): AnthropicClientLike {
  if (input.client) return input.client
  const key = input.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY missing')
  return new Anthropic({ apiKey: key })
}

function extractTextContent(resp: { content?: Array<{ type: string; text?: string }> }): string {
  if (!resp.content) return ''
  return resp.content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n')
}

function errorEvidence(reason: string, sourceUrl: string | null): ScraperEvidence {
  return {
    source_key: SOURCE_KEY,
    finding_type: 'source_error' as TrustFindingType,
    confidence: 'low_inference' as TrustConfidence,
    finding_summary: `Claude web_search failed: ${reason}`,
    extracted_facts: { reason, source_url: sourceUrl },
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  }
}

export async function scrapeClaudeWebSearchVerify(
  input: ClaudeWebSearchVerifyInput,
): Promise<ScraperEvidence> {
  let client: AnthropicClientLike
  try { client = getClient(input) }
  catch (err) { return errorEvidence((err as Error)?.message ?? 'init failed', input.citationUrl) }

  const tools: WebSearchTool[] = [{
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: DEFAULT_VERIFY_MAX_USES,
  }]

  const systemPrompt =
    'You are a verification agent for contractor trust reports. Given a CLAIM and a CITATION URL, fetch the URL, read the content, and decide whether the claim is supported. ' +
    'Return strict JSON only — no prose, no markdown — with this shape: ' +
    '{ "verified": boolean, "confidence": "high"|"medium"|"low", "supporting_quote": string|null, "contradicting_evidence": string|null, "source_type": "news"|"government"|"court"|"blog"|"social"|"other" }.'

  const userPrompt =
    `CLAIM: ${input.claim}\nCITATION URL: ${input.citationUrl}\nCONTRACTOR: ${input.contractorName}\n\nVerify.`

  const start = Date.now()
  let resp: { content?: Array<{ type: string; text?: string }> }
  try {
    resp = await (client.messages.create as unknown as (args: Record<string, unknown>) => Promise<{ content?: Array<{ type: string; text?: string }> }>)({
      model: input.model ?? DEFAULT_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      tools,
      messages: [{ role: 'user', content: userPrompt }],
    })
  } catch (err) {
    return errorEvidence((err as Error)?.message ?? 'API failed', input.citationUrl)
  }

  const text = extractTextContent(resp)
  const parsed = tryParseJson<VerifyResult>(text)
  const duration_ms = Date.now() - start

  if (!parsed) {
    return errorEvidence('parse_failure', input.citationUrl)
  }

  const findingType: TrustFindingType = parsed.verified ? 'open_web_verified' : 'open_web_unverified'
  return {
    source_key: SOURCE_KEY,
    finding_type: findingType,
    confidence: confidenceToScraperConfidence(parsed.confidence),
    finding_summary: parsed.verified
      ? `Claim verified via web_search (${parsed.confidence}): ${input.claim.slice(0, 120)}`
      : `Claim NOT verified via web_search (${parsed.confidence}): ${input.claim.slice(0, 120)}`,
    extracted_facts: {
      claim: input.claim,
      citation_url: input.citationUrl,
      contractor_name: input.contractorName,
      verified: parsed.verified,
      verification_confidence: parsed.confidence,
      supporting_quote: parsed.supporting_quote ?? null,
      contradicting_evidence: parsed.contradicting_evidence ?? null,
      source_type: parsed.source_type ?? null,
    },
    query_sent: input.citationUrl,
    response_sha256: null,
    response_snippet: text.slice(0, 1500),
    duration_ms,
    cost_cents: 1,
  }
}

export async function scrapeClaudeWebSearchTargeted(
  input: ClaudeWebSearchTargetedInput,
): Promise<ScraperEvidence[]> {
  let client: AnthropicClientLike
  try { client = getClient(input) }
  catch (err) { return [errorEvidence((err as Error)?.message ?? 'init failed', null)] }

  const tools: WebSearchTool[] = [{
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: DEFAULT_TARGETED_MAX_USES,
    user_location: input.userLocation
      ? { type: 'approximate', city: input.userLocation.city, region: input.userLocation.region, country: 'US' }
      : undefined,
  }]

  const systemPrompt =
    'You are a contractor verification agent. Use web search to investigate the contractor relative to the user query. ' +
    'Return strict JSON only — no prose, no markdown — with this shape: ' +
    '{ "findings": [{ "claim": string, "citation_url": string, "claim_type": "adverse"|"positive"|"neutral", "confidence": "high"|"medium"|"low" }] }. ' +
    'Up to 6 findings. Drop neutral findings unless they are notable.'

  const userPrompt =
    `Contractor: ${input.legalName}\nLocation: ${input.city ?? '—'}, ${input.stateCode}\nQuery: ${input.query}\n\nInvestigate.`

  const start = Date.now()
  let resp: { content?: Array<{ type: string; text?: string }> }
  try {
    resp = await (client.messages.create as unknown as (args: Record<string, unknown>) => Promise<{ content?: Array<{ type: string; text?: string }> }>)({
      model: input.model ?? DEFAULT_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      tools,
      messages: [{ role: 'user', content: userPrompt }],
    })
  } catch (err) {
    return [errorEvidence((err as Error)?.message ?? 'API failed', null)]
  }

  const text = extractTextContent(resp)
  const parsed = tryParseJson<TargetedResult>(text)
  const duration_ms = Date.now() - start

  if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length === 0) {
    return [{
      source_key: SOURCE_KEY,
      finding_type: 'raw_source_response' as TrustFindingType,
      confidence: 'medium_llm' as TrustConfidence,
      finding_summary: `Targeted Claude web_search returned no findings for "${input.legalName}"`,
      extracted_facts: { query: input.query, response_text: text.slice(0, 1000) },
      query_sent: input.query,
      response_sha256: null,
      response_snippet: text.slice(0, 1500),
      duration_ms,
      cost_cents: 2,
    }]
  }

  const evidence: ScraperEvidence[] = parsed.findings
    .filter((f) => f.claim_type !== 'neutral')
    .map((f) => ({
      source_key: SOURCE_KEY,
      finding_type:
        f.claim_type === 'adverse' ? 'open_web_adverse_signal'
        : f.claim_type === 'positive' ? 'open_web_positive_signal'
        : 'raw_source_response',
      confidence: confidenceToScraperConfidence(f.confidence),
      finding_summary: `${f.claim_type === 'adverse' ? 'Adverse' : 'Positive'} (Claude targeted): ${f.claim.slice(0, 200)}`,
      extracted_facts: {
        claim: f.claim,
        citation_url: f.citation_url,
        claim_type: f.claim_type,
        confidence: f.confidence,
        contractor_name: input.legalName,
        targeted_query: input.query,
      },
      query_sent: f.citation_url,
      response_sha256: null,
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    }))

  if (evidence.length === 0) {
    return [{
      source_key: SOURCE_KEY,
      finding_type: 'raw_source_response' as TrustFindingType,
      confidence: 'medium_llm' as TrustConfidence,
      finding_summary: `Targeted Claude web_search: ${parsed.findings.length} neutral findings for "${input.legalName}" (no adverse/positive signals)`,
      extracted_facts: { query: input.query, neutral_findings: parsed.findings },
      query_sent: input.query,
      response_sha256: null,
      response_snippet: null,
      duration_ms,
      cost_cents: 2,
    }]
  }

  // Cost attribution sits on the first emitted row.
  evidence[0].cost_cents = 2
  evidence[0].duration_ms = duration_ms
  return evidence
}
