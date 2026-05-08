import { describe, expect, it, vi } from 'vitest'
import {
  scrapeClaudeWebSearchVerify,
  scrapeClaudeWebSearchTargeted,
} from '../claude-web-search'

function fakeClient(textResponse: string) {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: textResponse }],
      })),
    },
  }
}

function failingClient(err: Error) {
  return {
    messages: {
      create: vi.fn(async () => { throw err }),
    },
  }
}

describe('scrapeClaudeWebSearchVerify', () => {
  it('emits open_web_verified on verified=true', async () => {
    const client = fakeClient('{"verified": true, "confidence": "high", "supporting_quote": "Court order shows...", "source_type": "court"}')
    const ev = await scrapeClaudeWebSearchVerify({
      claim: 'Acme was sued', citationUrl: 'https://x', contractorName: 'Acme',
      client: client as any,
    })
    expect(ev.finding_type).toBe('open_web_verified')
    expect(ev.confidence).toBe('high_llm')
  })

  it('emits open_web_unverified on verified=false', async () => {
    const client = fakeClient('{"verified": false, "confidence": "medium", "contradicting_evidence": "Page is unrelated"}')
    const ev = await scrapeClaudeWebSearchVerify({
      claim: 'Acme was sued', citationUrl: 'https://x', contractorName: 'Acme',
      client: client as any,
    })
    expect(ev.finding_type).toBe('open_web_unverified')
  })

  it('handles API failure as source_error', async () => {
    const client = failingClient(new Error('rate_limit'))
    const ev = await scrapeClaudeWebSearchVerify({
      claim: 'X', citationUrl: 'https://x', contractorName: 'Acme',
      client: client as any,
    })
    expect(ev.finding_type).toBe('source_error')
  })

  it('handles unparseable response as source_error', async () => {
    const client = fakeClient('not json at all')
    const ev = await scrapeClaudeWebSearchVerify({
      claim: 'X', citationUrl: 'https://x', contractorName: 'Acme',
      client: client as any,
    })
    expect(ev.finding_type).toBe('source_error')
  })

  it('handles missing API key without client provided', async () => {
    const original = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const ev = await scrapeClaudeWebSearchVerify({
      claim: 'X', citationUrl: 'https://x', contractorName: 'Acme',
    })
    expect(ev.finding_type).toBe('source_error')
    if (original) process.env.ANTHROPIC_API_KEY = original
  })
})

describe('scrapeClaudeWebSearchTargeted', () => {
  it('emits one row per adverse/positive finding, drops neutral', async () => {
    const client = fakeClient('{"findings":[{"claim":"sued for fraud","citation_url":"https://a","claim_type":"adverse","confidence":"high"},{"claim":"BBB accredited","citation_url":"https://b","claim_type":"positive","confidence":"medium"},{"claim":"general info","citation_url":"https://c","claim_type":"neutral","confidence":"low"}]}')
    const ev = await scrapeClaudeWebSearchTargeted({
      legalName: 'Acme', stateCode: 'CO', query: 'enforcement',
      client: client as any,
    })
    expect(ev.length).toBe(2)
    expect(ev[0].finding_type).toBe('open_web_adverse_signal')
    expect(ev[1].finding_type).toBe('open_web_positive_signal')
  })

  it('returns single raw_source_response row when no findings', async () => {
    const client = fakeClient('{"findings":[]}')
    const ev = await scrapeClaudeWebSearchTargeted({
      legalName: 'Acme', stateCode: 'CO', query: 'X',
      client: client as any,
    })
    expect(ev).toHaveLength(1)
    expect(ev[0].finding_type).toBe('raw_source_response')
  })

  it('handles API failure as source_error', async () => {
    const client = failingClient(new Error('boom'))
    const ev = await scrapeClaudeWebSearchTargeted({
      legalName: 'Acme', stateCode: 'CO', query: 'X',
      client: client as any,
    })
    expect(ev[0].finding_type).toBe('source_error')
  })
})
