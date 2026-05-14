/**
 * runTrustSynthesizeV2 — prompt + tool schema + validator + tier configs +
 * free-tier templated path. Pure functions only; no I/O. Fully unit-testable.
 */

export type SynthesisTier = 'free' | 'standard' | 'plus' | 'deep_dive' | 'forensic';

export const FORBIDDEN_VOCAB = [
  'fraud', 'scam', 'criminal', 'illegal',
  'unsafe', 'dangerous', 'unreliable', 'dishonest',
] as const;

export type TierConfig = {
  useLLM: boolean;
  model: string | null;
  costCapCents: number;
  maxTokens: number;
};

export const TIER_CONFIG: Record<SynthesisTier, TierConfig> = {
  free:      { useLLM: false, model: null,                  costCapCents: 0,   maxTokens: 0    },
  standard:  { useLLM: true,  model: 'claude-sonnet-4-6',   costCapCents: 200,  maxTokens: 1500 },
  plus:      { useLLM: true,  model: 'claude-sonnet-4-6',   costCapCents: 200,  maxTokens: 1500 },
  deep_dive: { useLLM: true,  model: 'claude-opus-4-7',     costCapCents: 500, maxTokens: 3000 },
  forensic:  { useLLM: true,  model: 'claude-opus-4-7',     costCapCents: 500, maxTokens: 3000 },
};

// ---------------------------------------------------------------------------
// Tool schema for Anthropic submit_synthesis call
// ---------------------------------------------------------------------------

export const SUBMIT_SYNTHESIS_TOOL = {
  name: 'submit_synthesis',
  description:
    'Submit the structured trust report synthesis. Every red_flag and positive ' +
    'must cite at least one evidence_id from the provided evidence pool.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: '2-4 sentence neutral factual summary. No recommendations.',
      },
      red_flags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text:          { type: 'string' },
            evidence_ids:  { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
          required: ['text', 'evidence_ids'],
        },
      },
      positives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text:          { type: 'string' },
            evidence_ids:  { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
          required: ['text', 'evidence_ids'],
        },
      },
      confidence: {
        type: 'string',
        enum: ['HIGH', 'MEDIUM', 'LOW'],
      },
      phoenix_pattern_assessment: {
        type: 'string',
        description:
          'One-sentence assessment of phoenix-company patterns. If phoenix_score<80 (convention: 100=clean, 0=max signals), ' +
          'must explicitly address the phoenix pattern.',
      },
    },
    required: ['summary', 'red_flags', 'positives', 'confidence', 'phoenix_pattern_assessment'],
  },
} as const;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return [
    'You are Groundcheck, a contractor verification synthesizer. You produce',
    'fact-based, neutral trust report syntheses by reducing structured evidence',
    'rows into a defensible summary.',
    '',
    'STRICT RULES:',
    `1. Every red_flag and positive MUST cite at least one evidence_id from the`,
    '   provided evidence pool. Citing a non-existent evidence_id is a hard fail.',
    `2. NEVER use these words anywhere in your output: ${FORBIDDEN_VOCAB.join(', ')}.`,
    '   These are defamation risks. Use neutral factual language instead.',
    '3. Do NOT make hiring or do-business-with recommendations. Report facts.',
    '4. If phoenix_score < 80 (RPC convention: 100=clean, 0=max signals), your phoenix_pattern_assessment MUST',
    '   explicitly address the phoenix pattern (use the word "phoenix" or',
    '   "successor entity").',
    '5. Set confidence=LOW if evidence_count<3 OR structured_hit_rate<0.4.',
    '   Otherwise set HIGH or MEDIUM based on evidence quality.',
    '6. Output via the submit_synthesis tool only. No prose response.',
    '7. PHOENIX_SIGNALS handling (when section is present in user message):',
    '   - For each signal marked "cite via evidence_id [...]", emit a red_flag',
    '     citing that evidence_id. The signal is a defensible, evidence-backed',
    '     finding — surface it as a first-class red_flag.',
    '   - For each signal marked "NARRATIVE ONLY", DO NOT emit a red_flag for',
    '     it. Incorporate it into phoenix_pattern_assessment instead. These',
    '     signals lack a citable per-row evidence chain by construction.',
    '',
    'RED FLAG CALIBRATION RULES (CRITICAL):',
    '',
    'The following findings are NEUTRAL signals and MUST NOT be classified as red_flags:',
    '',
    '1. CROSS-JURISDICTION ABSENCE: If the contractor is registered in only one state (per CO SOS or TX SOS), absence of records in OTHER jurisdictions is expected and neutral. Do NOT treat as adverse:',
    '   - "No TX franchise tax record" when contractor\'s only verified registration is in CO',
    '   - "Zero Dallas permits" when contractor\'s only verified operations are in CO',
    '   - "Zero Denver permits" when contractor\'s only verified operations are in TX',
    '   - Mention these in the summary as "operates only in [state]" — NOT in red_flags.',
    '',
    '2. OPERATIONAL DATA GAPS: Source unavailability is an operational issue, NOT a contractor signal. Do NOT classify as red_flag:',
    '   - "SAM.gov rate-limited" / "scraper failed" / "API timeout"',
    '   - Mention in summary as "data not available at time of report" — NOT in red_flags.',
    '',
    '3. WEAK PERMIT SIGNALS: Zero permits in the contractor\'s PRIMARY jurisdiction is a WEAK signal that must be combined with at least one OTHER adverse signal (lapsed registration, court judgment, OSHA citation, BBB complaint pattern) before being classified as red_flag. A clean-license contractor with zero permits in one jurisdiction is more likely operating under a DBA, doing permit-exempt work, or operating as a subcontractor — not a fraud signal in isolation.',
    '',
    'ADVERSE SIGNALS that ARE red_flags:',
    '- Lapsed, suspended, revoked, or absent business registration in the contractor\'s STATED home state',
    '- Active SAM.gov exclusion or debarment finding (NOT data unavailable — only if data WAS retrieved and showed exclusion)',
    '- OSHA willful or repeat citations',
    '- Civil judgments against the contractor as defendant',
    '- Documented enforcement actions from state licensing boards',
    '- Phoenix patterns (officer linking dissolved entity to active entity)',
    '- Combined low permit volume + lapsed registration + at least one other adverse signal',
    '',
    'CALIBRATION TARGET:',
    'A clean Colorado-only GC with active CO SOS Good Standing and reasonable permit history should score 80-100. A contractor with no business registration found anywhere should score 30-50. A contractor with documented enforcement action plus active operations should score 0-30.',
  ].join('\n');
}

export function buildUserPrompt(args: {
  contractorName: string;
  city: string | null;
  stateCode: string;
  score: ScoreContext;
  evidence: EvidenceItem[];
  phoenixSignals?: PhoenixSignal[];
}): string {
  const { contractorName, city, stateCode, score, evidence, phoenixSignals } = args;
  const evidenceLines = evidence.map((e) =>
    `[${e.id}] source=${e.source_key} type=${e.finding_type} ` +
    `confidence=${e.confidence}: ${e.finding_summary}`
  );

  const lines: string[] = [
    `Contractor: ${contractorName}`,
    `Location: ${city ?? '(unspecified)'}, ${stateCode}`,
    '',
    'Computed score (deterministic, do not recompute):',
    `  composite_score: ${score.composite_score}/100`,
    `  grade: ${score.grade}`,
    `  risk_level: ${score.risk_level}`,
    `  phoenix_score: ${score.phoenix_score}`,
    `  evidence_count: ${score.evidence_count}`,
    `  structured_hit_rate: ${score.structured_hit_rate}`,
    `  sanction_hit: ${score.sanction_hit}`,
    `  license_suspended: ${score.license_suspended}`,
    '',
    `Evidence pool (${evidence.length} rows):`,
    ...evidenceLines,
  ];

  if (phoenixSignals && phoenixSignals.length > 0) {
    lines.push('');
    lines.push(`PHOENIX_SIGNALS (${phoenixSignals.length} signals):`);
    for (const sig of phoenixSignals) {
      if (sig.signal === 'shared_officer_with_dissolved' || sig.signal === 'shared_officer_with_active') {
        const ev = sig.evidence;
        const cite = ev.source_evidence_id
          ? `cite via evidence_id [${ev.source_evidence_id}]`
          : 'NARRATIVE ONLY (no source_evidence_id available)';
        lines.push(
          `  [${sig.signal}] weight=${sig.weight} officer=${ev.officer_id} other_contractor=${ev.other_contractor_id} edge=${ev.edge_id} — ${cite}`,
        );
      } else {
        lines.push(
          `  [${sig.signal}] weight=${sig.weight} ${JSON.stringify(sig.evidence)} — NARRATIVE ONLY (aggregate signal)`,
        );
      }
    }
  }

  lines.push('');
  lines.push('Synthesize via submit_synthesis tool now.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreContext = {
  composite_score: number;
  grade: string;
  risk_level: string;
  phoenix_score: number;
  evidence_count: number;
  structured_hit_rate: number;
  sanction_hit: boolean;
  license_suspended: boolean;
  legal_score: number;
  business_entity_score: number;
  license_score: number;
  bbb_score: number;
  osha_score: number;
};

export type EvidenceItem = {
  id: string;
  source_key: string;
  finding_type: string;
  confidence: string;
  finding_summary: string;
};

/**
 * Phoenix signal returned by detect_contractor_phoenix_signals_enriched (migration 122).
 * shared_officer_* signals carry an optional source_evidence_id pulled from
 * trust_officer_links (this contractor's own officer write — guaranteed in-pool).
 * Aggregate signals (phone/address/ein/website/name) carry no per-row evidence.
 */
export type PhoenixSignal =
  | { signal: 'shared_officer_with_dissolved'; weight: 0.5;
      evidence: { officer_id: string; other_contractor_id: string; edge_id: string; source_evidence_id?: string } }
  | { signal: 'shared_officer_with_active'; weight: 0.25;
      evidence: { officer_id: string; other_contractor_id: string; edge_id: string; source_evidence_id?: string } }
  | { signal: 'shared_phone'; weight: 0.4;
      evidence: { match_count: number } }
  | { signal: 'address_shared_with_many'; weight: 0.25;
      evidence: { other_contractor_count: number } }
  | { signal: 'address_shared'; weight: 0.10;
      evidence: { other_contractor_count: number } }
  | { signal: 'shared_ein'; weight: 0.6;
      evidence: Record<string, never> }
  | { signal: 'shared_website'; weight: 0.35;
      evidence: Record<string, never> }
  | { signal: 'similar_name_same_state'; weight: 0.3;
      evidence: { sibling_count: number } };

export type SynthesisOutput = {
  summary: string;
  red_flags: Array<{ text: string; evidence_ids: string[] }>;
  positives: Array<{ text: string; evidence_ids: string[] }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  phoenix_pattern_assessment: string;
};

export type ValidationResult =
  | { ok: true;  output: SynthesisOutput }
  | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateSynthesis(
  raw: unknown,
  evidence: EvidenceItem[],
  score: ScoreContext,
): ValidationResult {
  const errors: string[] = [];
  const evidenceIds = new Set(evidence.map((e) => e.id));

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['synthesis output is not an object'] };
  }
  const r = raw as Record<string, unknown>;

  // Field presence + types
  if (typeof r.summary !== 'string') errors.push('summary missing or not a string');
  if (!Array.isArray(r.red_flags)) errors.push('red_flags missing or not an array');
  if (!Array.isArray(r.positives)) errors.push('positives missing or not an array');
  if (typeof r.confidence !== 'string') errors.push('confidence missing or not a string');
  if (typeof r.phoenix_pattern_assessment !== 'string') errors.push('phoenix_pattern_assessment missing');

  if (errors.length > 0) return { ok: false, errors };

  const summary = r.summary as string;
  const redFlags = r.red_flags as Array<{ text?: unknown; evidence_ids?: unknown }>;
  const positives = r.positives as Array<{ text?: unknown; evidence_ids?: unknown }>;
  let confidence = r.confidence as string;
  const phoenixAssessment = r.phoenix_pattern_assessment as string;

  // Citation validation
  const checkCitations = (arr: typeof redFlags, label: string) => {
    arr.forEach((item, i) => {
      if (typeof item.text !== 'string') {
        errors.push(`${label}[${i}].text not a string`);
        return;
      }
      if (!Array.isArray(item.evidence_ids) || item.evidence_ids.length === 0) {
        errors.push(`${label}[${i}] has no evidence_ids`);
        return;
      }
      for (const eid of item.evidence_ids) {
        if (typeof eid !== 'string' || !evidenceIds.has(eid)) {
          errors.push(`${label}[${i}] cites unknown evidence_id "${eid}"`);
        }
      }
    });
  };
  checkCitations(redFlags, 'red_flags');
  checkCitations(positives, 'positives');

  // Forbidden vocab — case-insensitive whole-word match
  const checkVocab = (text: string, where: string) => {
    const lower = text.toLowerCase();
    for (const word of FORBIDDEN_VOCAB) {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(lower)) {
        errors.push(`forbidden vocab "${word}" in ${where}`);
      }
    }
  };
  checkVocab(summary, 'summary');
  checkVocab(phoenixAssessment, 'phoenix_pattern_assessment');
  redFlags.forEach((rf, i) => {
    if (typeof rf.text === 'string') checkVocab(rf.text, `red_flags[${i}].text`);
  });
  positives.forEach((p, i) => {
    if (typeof p.text === 'string') checkVocab(p.text, `positives[${i}].text`);
  });

  // Confidence enum
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
    errors.push(`confidence "${confidence}" not in {HIGH,MEDIUM,LOW}`);
  }

  // LOW-confidence forcing
  const mustBeLow = score.evidence_count < 3 || score.structured_hit_rate < 0.4;
  if (mustBeLow && confidence !== 'LOW') {
    confidence = 'LOW'; // force-overwrite, not an error
  }

  // Phoenix surfacing requirement
  if (score.phoenix_score < 80) {
    const lower = phoenixAssessment.toLowerCase();
    if (!lower.includes('phoenix') && !lower.includes('successor entity')) {
      errors.push('phoenix_score<80 but phoenix_pattern_assessment does not address phoenix pattern');
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    output: {
      summary,
      red_flags: redFlags as SynthesisOutput['red_flags'],
      positives: positives as SynthesisOutput['positives'],
      confidence: confidence as SynthesisOutput['confidence'],
      phoenix_pattern_assessment: phoenixAssessment,
    },
  };
}

// ---------------------------------------------------------------------------
// Free-tier templated path (no LLM)
// ---------------------------------------------------------------------------

/**
 * Evidence-existence gate flags. Required for score-based red flags that
 * could otherwise stamp false-positive findings (phoenix, license_suspended)
 * when the score field is set but no backing trust_evidence row exists.
 * Computed by callers via `evidenceBackedFlags()` from
 * `./synth/templated-flag-gate.ts`. Pass null/undefined to fail-closed
 * (never stamp these flags) — that's the safe default for tests + unit work.
 */
export interface TemplatedEvidenceFlags {
  phoenix: boolean;
  license_suspended: boolean;
}

export function buildFreeTierSynthesis(
  score: ScoreContext,
  evidenceFlags?: TemplatedEvidenceFlags | null,
): SynthesisOutput {
  const summary =
    `Composite trust score ${score.composite_score}/100 ` +
    `(grade ${score.grade}, ${score.risk_level} risk) ` +
    `based on ${score.evidence_count} evidence finding${score.evidence_count === 1 ? '' : 's'}.`;

  const red_flags: SynthesisOutput['red_flags'] = [];
  // Free tier has no evidence_ids (no LLM citations); use sentinel for downstream tracking.
  const FREE_TIER_SENTINEL = ['__free_tier_no_citation__'];

  if (score.sanction_hit) {
    // sanction_hit is set directly from sam_gov_exclusions evidence rows
    // by the scoring layer, so it's already evidence-backed.
    red_flags.push({
      text: 'Active sanction or watchlist hit detected.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }
  // license_suspended + phoenix must have BOTH the score signal AND a backing
  // trust_evidence row of a relevant finding_type — otherwise the templated
  // fallback fabricates red flags on every LLM stall. Fail-closed when
  // evidenceFlags is absent.
  if (score.license_suspended && evidenceFlags?.license_suspended === true) {
    red_flags.push({
      text: 'License shows suspended status.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }
  if (score.phoenix_score < 80 && evidenceFlags?.phoenix === true) {
    red_flags.push({
      text: 'Phoenix-company pattern indicators present.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }

  const positives: SynthesisOutput['positives'] = [];
  if (score.legal_score >= 80) {
    positives.push({
      text: 'Clean legal record per available public sources.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }
  if (score.business_entity_score >= 80) {
    positives.push({
      text: 'Business entity in good standing.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }
  if (score.license_score >= 80) {
    positives.push({
      text: 'License active and in good standing.',
      evidence_ids: FREE_TIER_SENTINEL,
    });
  }

  const confidence: SynthesisOutput['confidence'] =
    score.evidence_count < 3 || score.structured_hit_rate < 0.4 ? 'LOW' :
    score.evidence_count >= 8 && score.structured_hit_rate >= 0.7 ? 'HIGH' :
    'MEDIUM';

  const phoenix_pattern_assessment = score.phoenix_score < 80
    ? `Phoenix-company indicators present (score=${score.phoenix_score}); successor entity review recommended.`
    : 'No phoenix-company indicators detected.';

  return { summary, red_flags, positives, confidence, phoenix_pattern_assessment };
}

export const FREE_TIER_CITATION_SENTINEL = '__free_tier_no_citation__';
