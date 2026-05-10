import { describe, expect, it } from 'vitest'
import { scrapePerplexitySweep } from '../perplexity-sweep'

function fakeFetch(body: unknown, ok = true, status = 200) {
  return async (): Promise<Response> => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response)
}

describe('scrapePerplexitySweep', () => {
  it('returns source_error when API key is missing', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: '',
      fetchFn: fakeFetch({ choices: [{ message: { content: '' } }] }),
    })
    expect(ev[0].finding_type).toBe('source_error')
  })

  it('emits raw_source_response envelope on successful sweep', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({
        choices: [{ message: { content: 'Acme has been operating cleanly.' } }],
        citations: [],
      }),
    })
    expect(ev[0].finding_type).toBe('raw_source_response')
    expect(ev[0].extracted_facts.citation_count).toBe(0)
  })

  it('classifies adverse keywords', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({
        choices: [{ message: { content: 'See sources.' } }],
        citations: [
          { url: 'https://news/article1', title: 'Acme sued for fraud', snippet: 'A lawsuit was filed' },
        ],
      }),
    })
    const adverse = ev.find((e) => e.finding_type === 'open_web_adverse_signal')
    expect(adverse).toBeDefined()
    expect(adverse?.extracted_facts.citation_url).toBe('https://news/article1')
  })

  it('classifies positive keywords', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({
        choices: [{ message: { content: '' } }],
        citations: [
          { url: 'https://news/award', title: 'Acme awarded BBB accreditation', snippet: '' },
        ],
      }),
    })
    expect(ev.some((e) => e.finding_type === 'open_web_positive_signal')).toBe(true)
  })

  it('drops neutral classifications', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({
        choices: [{ message: { content: '' } }],
        citations: [
          { url: 'https://blog/general', title: 'About Acme', snippet: 'A company in the area.' },
        ],
      }),
    })
    expect(ev.filter((e) => e.finding_type !== 'raw_source_response')).toHaveLength(0)
  })

  it('handles HTTP non-200 as source_error', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({}, false, 500),
    })
    expect(ev[0].finding_type).toBe('source_error')
  })

  it('handles network error as source_error', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: async () => { throw new Error('connection refused') },
    })
    expect(ev[0].finding_type).toBe('source_error')
    expect(ev[0].finding_summary).toMatch(/connection refused/)
  })

  it('normalizes string-array citations', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme', stateCode: 'CO', apiKey: 'fake',
      fetchFn: fakeFetch({
        choices: [{ message: { content: 'Acme sued for fraud' } }],
        citations: ['https://news/article1', 'https://news/article2'],
      }),
    })
    // String citations have no title/snippet to classify against, so they
    // default to neutral and get dropped — only the envelope row remains.
    expect(ev.find((e) => e.finding_type === 'raw_source_response')).toBeDefined()
  })

  it('embeds query + model into facts', async () => {
    const ev = await scrapePerplexitySweep({
      legalName: 'Acme Roofing', city: 'Denver', stateCode: 'CO', apiKey: 'fake',
      model: 'sonar-pro', lookbackMonths: 24,
      fetchFn: fakeFetch({
        choices: [{ message: { content: '' } }],
        citations: [{ url: 'https://x', title: 'Acme Roofing complaint filed' }],
      }),
    })
    const env = ev[0]
    expect(env.extracted_facts.model_used).toBe('sonar-pro')
    expect(env.extracted_facts.query).toMatch(/Acme Roofing/)
    expect(env.extracted_facts.query).toMatch(/Denver, CO/)
    expect(env.extracted_facts.query).toMatch(/24 months/)
  })
})
