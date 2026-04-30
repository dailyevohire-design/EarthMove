import Anthropic from '@anthropic-ai/sdk';
import { isAllowedSourceUrl } from './url-allowlist';

/**
 * extractContractor — production primitive for extracting a structured
 * contractor record from unstructured evidence (web pages, scraped HTML,
 * search results) using Claude Opus 4.7 with strict tool use beta.
 *
 * Two operating modes:
 *  1. Search-then-extract (default): Turn 1 uses Anthropic's web_search
 *     server tool to gather citations; Turn 2 forces a strict-schema
 *     emit_contractor_record tool_use against the gathered text.
 *  2. Extract-only: caller passes evidenceText directly, skipping web_search.
 *     Used by HTML scrapers that already have the source page in hand.
 *
 * Security contract:
 *  - Every citation URL from web_search_tool_result is filtered through
 *    isAllowedSourceUrl() before being returned. Rejects are logged in
 *    rejectedCitations, never reach callers' fetch boundaries.
 *  - The model's emitted primary_source_url MUST pass the allowlist or
 *    extraction throws. No exceptions.
 *  - Strict tool use guarantees output shape; we additionally re-check
 *    the state_code matches input as defense in depth.
 *
 * Cost notes:
 *  - max_uses on web_search defaults to 4 (configurable).
 *  - pause_turn loop capped at 2 resumes (configurable). At cap, we
 *    proceed to turn 2 with whatever evidence accumulated.
 *  - cache_control on web_search results is intentionally NOT set in C3 —
 *    each call is one-shot. Add when batched re-extraction lands.
 *
 * NOT a public-facing endpoint. Caller is responsible for rate limiting,
 * cost tracking, and writing evidence rows. extractContractor is pure:
 * given input, returns extracted record + usage. No DB, no Inngest.
 */

const ANTHROPIC_BETA_STRICT = 'structured-outputs-2025-11-13';
const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_MAX_SEARCHES = 4;
const DEFAULT_MAX_RESUMES = 2;
const DEFAULT_MAX_TOKENS_TURN1 = 4096;
const DEFAULT_MAX_TOKENS_TURN2 = 1024;

export const CONTRACTOR_RECORD_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: [
    'legal_name','dba','state','license_number','license_status',
    'issue_date','expiration_date','addresses','phones',
    'primary_source_url','confidence','notes',
  ],
  properties: {
    legal_name: { type: 'string', minLength: 1, maxLength: 200 },
    dba: { type: ['string','null'], maxLength: 200 },
    state: { type: 'string', pattern: '^[A-Z]{2}$' },
    license_number: { type: ['string','null'], pattern: '^[A-Z0-9-]{1,32}$' },
    license_status: { type: 'string', enum: ['ACTIVE','EXPIRED','REVOKED','SUSPENDED','PENDING','UNKNOWN'] },
    issue_date: { type: ['string','null'], format: 'date' },
    expiration_date: { type: ['string','null'], format: 'date' },
    addresses: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['kind','line1','line2','city','state','zip'],
        properties: {
          kind: { type: 'string', enum: ['BUSINESS','MAILING','REGISTERED_AGENT'] },
          line1: { type: 'string', minLength: 1 },
          line2: { type: ['string','null'] },
          city: { type: 'string' },
          state: { type: 'string', pattern: '^[A-Z]{2}$' },
          zip: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$' },
        },
      },
    },
    phones: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['e164','kind'],
        properties: {
          e164: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
          kind: { type: 'string', enum: ['VOICE','MOBILE','FAX'] },
        },
      },
    },
    primary_source_url: { type: 'string', pattern: '^https://' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: ['string','null'], maxLength: 2000 },
  },
};

export type LicenseStatus = 'ACTIVE'|'EXPIRED'|'REVOKED'|'SUSPENDED'|'PENDING'|'UNKNOWN';

export interface ContractorAddress {
  kind: 'BUSINESS'|'MAILING'|'REGISTERED_AGENT';
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface ContractorPhone {
  e164: string;
  kind: 'VOICE'|'MOBILE'|'FAX';
}

export interface ContractorRecord {
  legal_name: string;
  dba: string | null;
  state: string;
  license_number: string | null;
  license_status: LicenseStatus;
  issue_date: string | null;
  expiration_date: string | null;
  addresses: ContractorAddress[];
  phones: ContractorPhone[];
  primary_source_url: string;
  confidence: number;
  notes: string | null;
}

export interface ExtractContractorInput {
  legalName: string;
  stateCode: string;
  city?: string;
  evidenceText?: string;
  maxSearches?: number;
  maxPauseResumes?: number;
  client?: Anthropic;
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface ExtractContractorResult {
  record: ContractorRecord;
  citations: string[];
  rejectedCitations: Array<{ url: string; reason: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    webSearchRequests: number;
  };
}

const TURN1_SYSTEM = [
  'You are a contractor-license researcher.',
  'Use web_search to gather facts about the named contractor from official state licensing portals, secretary of state business records, OSHA, BBB, and court records.',
  'Cite source URLs only from .gov, .state.<state>.us, official licensing board domains (e.g. myfloridalicense.com), or trusted federal endpoints (sam.gov, sec.gov, courtlistener.com).',
  'Do NOT include analysis or recommendations — return raw factual notes with citations.',
].join(' ');

const TURN2_SYSTEM = [
  'You extract a single canonical contractor record from research notes.',
  'You MUST call the emit_contractor_record tool exactly once with the structured record.',
  'If a field is unknown or unverified, use null (or UNKNOWN for license_status). Never fabricate.',
  'primary_source_url MUST be the most authoritative URL from the notes (state licensing portal preferred over BBB).',
].join(' ');

const EXTRACT_TOOL = {
  name: 'emit_contractor_record',
  description: 'Emit the canonical contractor record extracted from research notes.',
  // @ts-ignore strict is in the beta types
  strict: true,
  input_schema: CONTRACTOR_RECORD_SCHEMA,
};

function getClient(input: ExtractContractorInput): Anthropic {
  if (input.client) return input.client;
  return new Anthropic({ apiKey: input.apiKey ?? process.env.ANTHROPIC_API_KEY! });
}

function extractTextFromContent(content: any[]): string {
  return content
    .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n\n');
}

function extractCitations(content: any[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r && r.type === 'web_search_result' && typeof r.url === 'string') {
          urls.push(r.url);
        }
      }
    }
  }
  return urls;
}

function filterCitations(urls: string[]): {
  allowed: string[];
  rejected: Array<{ url: string; reason: string }>;
} {
  const allowed: string[] = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  for (const url of urls) {
    const r = isAllowedSourceUrl(url);
    if (r.allowed) allowed.push(url);
    else rejected.push({ url, reason: r.reason ?? 'host_not_allowed' });
  }
  return { allowed, rejected };
}

async function runSearchTurn(
  client: Anthropic,
  model: string,
  input: ExtractContractorInput,
  maxSearches: number,
  maxResumes: number,
): Promise<{ content: any[]; usage: any }> {
  const userPrompt = `Research contractor \"${input.legalName}\" in ${input.stateCode}${input.city ? ', ' + input.city : ''}. Return raw factual notes with source URLs.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [
    { role: 'user', content: userPrompt },
  ];

  let lastResp: any;
  for (let attempt = 0; attempt <= maxResumes; attempt++) {
    lastResp = await client.messages.create(
      {
        model,
        max_tokens: DEFAULT_MAX_TOKENS_TURN1,
        system: TURN1_SYSTEM,
        tools: [{
          type: 'web_search_20250305' as any,
          name: 'web_search',
          max_uses: maxSearches,
        }],
        messages,
        // @ts-ignore — abort signal supported in 0.90
        ...(input.signal ? { signal: input.signal } : {}),
      } as any
    );

    if (lastResp.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: lastResp.content });
  }
  return lastResp;
}

async function runExtractTurn(
  client: Anthropic,
  model: string,
  input: ExtractContractorInput,
  evidence: string,
): Promise<any> {
  const userPrompt = `Extract a canonical contractor record for \"${input.legalName}\" (${input.stateCode}) from these research notes:\n\n${evidence}`;

  return client.messages.create(
    {
      model,
      max_tokens: DEFAULT_MAX_TOKENS_TURN2,
      system: TURN2_SYSTEM,
      tools: [EXTRACT_TOOL as any],
      tool_choice: { type: 'tool', name: 'emit_contractor_record' } as any,
      messages: [{ role: 'user', content: userPrompt }],
      // @ts-ignore
      ...(input.signal ? { signal: input.signal } : {}),
    } as any,
    { headers: { 'anthropic-beta': ANTHROPIC_BETA_STRICT } } as any,
  );
}

export async function extractContractor(
  input: ExtractContractorInput,
): Promise<ExtractContractorResult> {
  if (!input.legalName || !input.legalName.trim()) {
    throw new Error('extractContractor: legalName is required');
  }
  if (!/^[A-Za-z]{2}$/.test(input.stateCode)) {
    throw new Error(`extractContractor: stateCode must be 2 letters, got: ${input.stateCode}`);
  }

  const client = getClient(input);
  const model = input.model ?? DEFAULT_MODEL;
  const maxSearches = input.maxSearches ?? DEFAULT_MAX_SEARCHES;
  const maxResumes = input.maxPauseResumes ?? DEFAULT_MAX_RESUMES;

  let evidence: string;
  let citations: string[] = [];
  let rejectedCitations: Array<{ url: string; reason: string }> = [];
  const usage = { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 };

  if (input.evidenceText && input.evidenceText.trim()) {
    evidence = input.evidenceText;
  } else {
    const turn1 = await runSearchTurn(client, model, input, maxSearches, maxResumes);
    evidence = extractTextFromContent(turn1.content);
    const allUrls = extractCitations(turn1.content);
    const filtered = filterCitations(allUrls);
    citations = filtered.allowed;
    rejectedCitations = filtered.rejected;
    usage.inputTokens += turn1.usage?.input_tokens ?? 0;
    usage.outputTokens += turn1.usage?.output_tokens ?? 0;
    usage.webSearchRequests += turn1.usage?.server_tool_use?.web_search_requests ?? 0;
  }

  if (!evidence || !evidence.trim()) {
    throw new Error('extractContractor: no evidence text gathered (turn 1 returned empty or skipped without evidenceText)');
  }

  const turn2 = await runExtractTurn(client, model, input, evidence);
  usage.inputTokens += turn2.usage?.input_tokens ?? 0;
  usage.outputTokens += turn2.usage?.output_tokens ?? 0;

  const toolUse = (turn2.content || []).find(
    (b: any) => b.type === 'tool_use' && b.name === 'emit_contractor_record',
  );
  if (!toolUse) {
    throw new Error('extractContractor: turn 2 did not return emit_contractor_record tool_use');
  }
  const record = toolUse.input as ContractorRecord;

  if (record.state !== input.stateCode.toUpperCase()) {
    throw new Error(
      `extractContractor: state mismatch — input ${input.stateCode}, output ${record.state}`,
    );
  }

  const primaryCheck = isAllowedSourceUrl(record.primary_source_url);
  if (!primaryCheck.allowed) {
    rejectedCitations.push({
      url: record.primary_source_url,
      reason: primaryCheck.reason ?? 'host_not_allowed',
    });
    throw new Error(
      `extractContractor: primary_source_url failed allowlist (${primaryCheck.reason}): ${record.primary_source_url}`,
    );
  }

  return { record, citations, rejectedCitations, usage };
}
