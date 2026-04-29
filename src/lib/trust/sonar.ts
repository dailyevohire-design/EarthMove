// src/lib/trust/sonar.ts
//
// Perplexity Sonar Pro — grounded research preprocessor for the trust engine.
// Runs BEFORE the Anthropic synthesis call so every claim in the final report
// can be backed by a real cited source URL. If Sonar is unavailable the engine
// falls back to web_search-only — we never block report generation on Sonar.
//
// Pricing (2026): $5 per 1k requests + ~$1/M tokens for sonar-pro.
// Typical cost per report: ~$0.007. Tune SONAR_COST_PER_CALL_USD as needed.

const SONAR_ENDPOINT       = 'https://api.perplexity.ai/chat/completions'
const SONAR_MODEL          = 'sonar-pro'
const SONAR_TIMEOUT_MS     = 30000
const SONAR_MAX_TOKENS_OUT = 1500
const SONAR_COST_PER_CALL_USD = 0.005

const SONAR_SYSTEM_PROMPT = `You are a research assistant for a contractor verification service. \
Search the open web and return concise, factual research findings about the named contractor entity. \
Focus on: business registration status (state Secretary of State), contractor licensing (state license boards), \
BBB rating and accreditation, OSHA citations, lawsuits/judgments/liens, customer reviews and \
complaints, news mentions, and AG consumer protection complaints. Quote claims from sources. \
Do NOT make up facts. If a source is uncertain, say so. Do NOT include analysis, opinions, or \
synthesis — only factual findings with inline citations.`

export interface SonarFindings {
  content:   string
  citations: string[]
  tokensIn:  number
  tokensOut: number
  costUsd:   number
}

export class SonarUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`sonar_unavailable: ${reason}`)
    this.name = 'SonarUnavailableError'
  }
}

export async function runSonarResearch(
  name: string,
  city: string,
  state: string,
  hints?: { address?: string | null; principal?: string | null; license_number?: string | null } | null,
): Promise<SonarFindings> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new SonarUnavailableError('missing_api_key')

  const userQuery = [
    `Contractor: ${name}`,
    `Location: ${city}, ${state}`,
    hints?.address        ? `Address: ${hints.address}`               : null,
    hints?.principal      ? `Principal: ${hints.principal}`           : null,
    hints?.license_number ? `License Number: ${hints.license_number}` : null,
    '',
    'Research this contractor and return findings on:',
    '1. Business registration status with the state Secretary of State',
    '2. Contractor license status with the state contractor licensing board',
    '3. BBB rating, accreditation status, and complaint count',
    '4. OSHA inspections and any violations',
    '5. Lawsuits, judgments, or liens involving the entity',
    '6. Customer review aggregate sentiment and rating',
    '7. State AG consumer protection complaints in the past 5 years',
    '',
    'Return concise factual findings with inline citations. No analysis, no opinion.',
  ].filter(Boolean).join('\n')

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), SONAR_TIMEOUT_MS)

  let resp: Response
  try {
    resp = await fetch(SONAR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:    SONAR_MODEL,
        messages: [
          { role: 'system', content: SONAR_SYSTEM_PROMPT },
          { role: 'user',   content: userQuery },
        ],
        return_citations:         true,
        return_related_questions: false,
        temperature:              0.0,
        max_tokens:               SONAR_MAX_TOKENS_OUT,
      }),
      signal: ac.signal,
    })
  } catch (e: unknown) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('aborted')) throw new SonarUnavailableError('timeout')
    throw new SonarUnavailableError(`fetch_failed: ${msg.slice(0, 200)}`)
  }
  clearTimeout(timer)

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new SonarUnavailableError(`http_${resp.status}: ${body.slice(0, 200)}`)
  }

  const data = await resp.json() as {
    choices?:   Array<{ message?: { content?: string } }>
    citations?: string[]
    usage?:     { prompt_tokens?: number; completion_tokens?: number }
  }

  const content   = data.choices?.[0]?.message?.content ?? ''
  const citations = Array.isArray(data.citations)
    ? data.citations.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0).slice(0, 20)
    : []
  const tokensIn  = data.usage?.prompt_tokens     ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0
  const costUsd   = SONAR_COST_PER_CALL_USD + (tokensIn + tokensOut) / 1e6 * 1.0

  return { content, citations, tokensIn, tokensOut, costUsd }
}
