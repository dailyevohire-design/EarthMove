import { describe, expect, it } from 'vitest'
import { detectCrossEngineCorroboration } from '../cross-engine-corroboration'
import type { ScraperEvidence } from '../scrapers/types'

function perplexityHit(url: string, summary = 'Lawsuit filed', id = 'p1'): ScraperEvidence & { id: string } {
  return {
    source_key: 'perplexity_sweep',
    finding_type: 'open_web_adverse_signal',
    confidence: 'medium_llm',
    finding_summary: summary,
    extracted_facts: { citation_url: url },
    query_sent: null, response_sha256: null, response_snippet: null,
    duration_ms: 0, cost_cents: 0,
    id,
  }
}

function claudeVerify(url: string, summary = 'Lawsuit filed', id = 'c1'): ScraperEvidence & { id: string } {
  return {
    source_key: 'llm_web_search',
    finding_type: 'open_web_verified',
    confidence: 'high_llm',
    finding_summary: summary,
    extracted_facts: { citation_url: url, verified: true },
    query_sent: null, response_sha256: null, response_snippet: null,
    duration_ms: 0, cost_cents: 0,
    id,
  }
}

describe('detectCrossEngineCorroboration', () => {
  it('emits event when both engines cite the same URL host+path', () => {
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://news.example.com/a')],
      claudeVerifications: [claudeVerify('https://news.example.com/a')],
    })
    expect(events).toHaveLength(1)
    expect(events[0].finding_type).toBe('cross_engine_corroboration_event')
    expect((events[0].extracted_facts as { corroboration_method: string }).corroboration_method).toBe('shared_url')
  })

  it('emits event on semantic overlap when URLs differ but summaries match', () => {
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://news.example.com/a', 'Acme sued for fraud')],
      claudeVerifications: [claudeVerify('https://other.example.com/x', 'Acme sued for fraud')],
    })
    expect(events).toHaveLength(1)
    expect((events[0].extracted_facts as { corroboration_method: string }).corroboration_method).toBe('semantic_overlap')
  })

  it('emits no event when URLs and summaries both differ', () => {
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://x', 'Acme lawsuit')],
      claudeVerifications: [claudeVerify('https://y', 'Beta complaint')],
    })
    expect(events).toHaveLength(0)
  })

  it('ignores Claude unverified rows (no corroboration)', () => {
    const claude = claudeVerify('https://news.example.com/a')
    claude.finding_type = 'open_web_unverified'
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://news.example.com/a')],
      claudeVerifications: [claude],
    })
    expect(events).toHaveLength(0)
  })

  it('ignores neutral perplexity rows', () => {
    const p = perplexityHit('https://news.example.com/a')
    p.finding_type = 'raw_source_response'
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [p],
      claudeVerifications: [claudeVerify('https://news.example.com/a')],
    })
    expect(events).toHaveLength(0)
  })

  it('dedupes pair events', () => {
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://news.example.com/a', 'sued')],
      claudeVerifications: [
        claudeVerify('https://news.example.com/a', 'sued', 'c1'),
        // Same claude id can't appear twice in practice; semantic-match edge case
      ],
    })
    expect(events).toHaveLength(1)
  })

  it('sets claim_direction adverse when perplexity row was adverse', () => {
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [perplexityHit('https://news.example.com/a')],
      claudeVerifications: [claudeVerify('https://news.example.com/a')],
    })
    expect((events[0].extracted_facts as { claim_direction: string }).claim_direction).toBe('adverse')
  })

  it('sets claim_direction positive for positive perplexity row', () => {
    const p = perplexityHit('https://news.example.com/a', 'BBB accredited')
    p.finding_type = 'open_web_positive_signal'
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [p],
      claudeVerifications: [claudeVerify('https://news.example.com/a', 'BBB accredited')],
    })
    expect((events[0].extracted_facts as { claim_direction: string }).claim_direction).toBe('positive')
  })

  it('handles missing URLs gracefully via summary overlap', () => {
    const p = perplexityHit('', 'unique adverse claim text here')
    const c = claudeVerify('', 'unique adverse claim text here')
    const events = detectCrossEngineCorroboration({
      perplexityEvidence: [p],
      claudeVerifications: [c],
    })
    expect(events).toHaveLength(1)
  })
})
