import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { runTrustOrchestratorV2 } from './orchestrator-v2'
import { resolveScrapersForTier, TIER_CONFIG as ORCHESTRATOR_TIER_CONFIG, type Tier } from './tier-config'
import { expandContractorNameVariants } from './name-variants'
import Anthropic from '@anthropic-ai/sdk';
import { callAnthropicWithWatchdog } from './anthropic-watchdog';
import {
  TIER_CONFIG,
  SUBMIT_SYNTHESIS_TOOL,
  buildSystemPrompt,
  buildUserPrompt,
  buildFreeTierSynthesis,
  validateSynthesis,
  type EvidenceItem,
  type PhoenixSignal,
  type ScoreContext,
  type SynthesisOutput,
  type SynthesisTier,
} from './synthesize-v2-prompt';

// Watchdog timeouts — short enough to fire before the SDK's 10-min default
// kills the request, generous enough that a typical Opus generation
// (~30-60s for 3000 tokens) doesn't get falsely tripped. Sonnet 4.6 is
// faster, so the fallback timeout is tighter.
const OPUS_WATCHDOG_TIMEOUT_MS = 90_000;
const SONNET_WATCHDOG_TIMEOUT_MS = 60_000;

// Extracts and validates the submit_synthesis tool_use from an Anthropic
// response. Throws if the model didn't return a well-formed tool_use OR if
// the validator rejects the synthesis. Used by both the primary call and
// the Sonnet fallback in runTrustSynthesizeV2.
function parseSynthesisToolUse(
  resp: Anthropic.Message,
  evidence: EvidenceItem[],
  score: ScoreContext,
): SynthesisOutput {
  const toolBlock = resp.content.find((b) => b.type === 'tool_use' && b.name === 'submit_synthesis');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error(`Anthropic did not return submit_synthesis tool_use; stop_reason=${resp.stop_reason}`);
  }
  const validation = validateSynthesis(toolBlock.input, evidence, score);
  if (!validation.ok) {
    throw new Error(`validator rejected synthesis: ${validation.errors.join('; ')}`);
  }
  return validation.output;
}

// Diagnostics helpers (PR #26). Migration 226 adds synthesis_started_at,
// synthesis_completed_at, synthesis_attempt_count to trust_jobs. These
// helpers write those columns; they're guarded with try/catch + a
// supabase-error-return check so the writes are NON-FATAL pre-migration.
//
// COALESCE / guarded-write design choice (commit 3 spec). The two options
// the spec presented were (A) information_schema.columns gating per write,
// or (B) write unconditionally and let the error reach onFailure. I chose
// option (C): write unconditionally, catch supabase-js errors at the call
// site, log + continue. Rationale: option A doubles the round-trip cost per
// write and requires either an RPC or a verbose CTE; option B fails the
// entire synthesis job because onFailure marks status='failed'. Option (C)
// is a one-line guard per helper, the columns either exist or they don't,
// and the only observable cost pre-migration is a console.warn line per
// synthesis. Documented in commit body.
async function markSynthesisStartedAt(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<void> {
  try {
    const { error } = await admin
      .from('trust_jobs')
      .update({ synthesis_started_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) {
      console.warn('[diagnostics] synthesis_started_at write failed (column likely absent pre-migration 226):', error.message);
    }
  } catch (e) {
    console.warn('[diagnostics] synthesis_started_at write threw:', (e as Error)?.message);
  }
}

async function markSynthesisCompletedAt(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<void> {
  try {
    const { error } = await admin
      .from('trust_jobs')
      .update({ synthesis_completed_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) {
      console.warn('[diagnostics] synthesis_completed_at write failed (column likely absent pre-migration 226):', error.message);
    }
  } catch (e) {
    console.warn('[diagnostics] synthesis_completed_at write threw:', (e as Error)?.message);
  }
}

async function incrementSynthesisAttemptCount(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<void> {
  // Read-modify-write — not atomic across concurrent runs, but synthesis is
  // concurrency-capped to 4 globally and one event = one job, so contention
  // on the same row is impossible. Off-by-one here is benign diagnostics.
  try {
    const { data, error: readErr } = await admin
      .from('trust_jobs')
      .select('synthesis_attempt_count')
      .eq('id', jobId)
      .maybeSingle();
    if (readErr) {
      console.warn('[diagnostics] read synthesis_attempt_count failed (column likely absent pre-migration 226):', readErr.message);
      return;
    }
    const next = ((data as { synthesis_attempt_count?: number | null } | null)?.synthesis_attempt_count ?? 0) + 1;
    const { error: writeErr } = await admin
      .from('trust_jobs')
      .update({ synthesis_attempt_count: next })
      .eq('id', jobId);
    if (writeErr) {
      console.warn('[diagnostics] increment synthesis_attempt_count failed:', writeErr.message);
    }
  } catch (e) {
    console.warn('[diagnostics] increment synthesis_attempt_count threw:', (e as Error)?.message);
  }
}

// Per-token pricing dispatch keyed on the actual billed model. Opus 4.7 is
// $5/MTok input + $25/MTok output (5e-6 / 2.5e-5 USD per token). Sonnet 4.6
// is $3/MTok / $15/MTok. Internal unit is microcents per token.
function computeCostCents(resp: Anthropic.Message, billingModel: string): number {
  const inputPerToken = billingModel === 'claude-opus-4-7' ? 500 : 300;
  const outputPerToken = billingModel === 'claude-opus-4-7' ? 2500 : 1500;
  const inputMicrocents = resp.usage.input_tokens * inputPerToken;
  const outputMicrocents = resp.usage.output_tokens * outputPerToken;
  return (inputMicrocents + outputMicrocents) / 1_000_000 * 100;
}

export const runTrustJobV2 = inngest.createFunction(
  {
    id: 'run-trust-job-v2',
    triggers: [{ event: 'trust/job.requested.v2' }],
    concurrency: { limit: 5 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      // event.data.event holds the original triggering event
      const orig = (event.data as any)?.event?.data ?? {}
      const adminClient = createAdminClient()
      if (orig.job_id) {
        await adminClient
          .from('trust_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: String(error?.message ?? error).slice(0, 500),
          })
          .eq('id', orig.job_id)
      }
    },
  },
  async ({ event, step }) => {
    const { job_id } = event.data as { job_id: string }
    const admin = createAdminClient()

    // Load job tier + contractor identity (orchestrator-v2 takes these as input).
    const job = await step.run('v2-load-job', async () => {
      const { data, error } = await admin
        .from('trust_jobs')
        .select('id, tier, contractor_name:contractor_name_input, state_code, city')
        .eq('id', job_id)
        .single()
      if (error) throw new Error(`v2-load-job: ${error.message}`)
      return data
    })

    const tier = job.tier as Tier
    const scraperKeys = await resolveScrapersForTier(tier, job.state_code)
    const nameVariantLimit = ORCHESTRATOR_TIER_CONFIG[tier]?.nameVariantLimit ?? 5

    // Delegate to runTrustOrchestratorV2 with runSynthesis: true. Orchestrator
    // wraps each scraper in step.run for durability and sendEvent's
    // trust/job.synthesize.requested at the end (handed off to runTrustSynthesizeV2).
    const result = await runTrustOrchestratorV2(
      {
        contractor_name: job.contractor_name,
        state_code: job.state_code,
        city: job.city,
        jobId: job_id,
      },
      {
        tier,
        runSynthesis: true,
        scraperKeys,
        synthesisModel: null, // synthesis function picks its own model from synthesize-v2-prompt config
        nameVariants: expandContractorNameVariants(job.contractor_name, nameVariantLimit),
      },
      step,
    )

    return { job_id: result.job_id, kind: result.kind, sources_attempted: scraperKeys.length }
  },
)

// ---------------------------------------------------------------------------
// runTrustSynthesizeV2 — closes the v2 brain loop
// Triggered by 'trust/job.synthesize.requested' emitted from runTrustJobV2.
// Reduces trust_evidence rows + computed score into a structured report.
// ---------------------------------------------------------------------------

export const runTrustSynthesizeV2 = inngest.createFunction(
  {
    id: 'run-trust-synthesize-v2',
    triggers: [{ event: 'trust/job.synthesize.requested' }],
    concurrency: { limit: 4 },
    retries: 2,
    // PR #26 / Mode 1 fix. Without this handler, any throw out of a step
    // body — non-timeout SDK error, validator rejection, score RPC failure —
    // exhausted the 2 function retries and left trust_jobs.status stuck on
    // 'synthesizing' forever (Bedrock job d34ea85f symptom). Mirror
    // runTrustJobV2's onFailure: mark the row failed so the user sees an
    // error and the pg_cron sweeper from migration 225 has fewer jobs to
    // catch.
    onFailure: async ({ event, error }) => {
      const orig = (event.data as { event?: { data?: { job_id?: string } } })?.event?.data ?? {}
      const adminClient = createAdminClient()
      if (orig.job_id) {
        await adminClient
          .from('trust_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: String(error?.message ?? error).slice(0, 500),
          })
          .eq('id', orig.job_id)
      }
    },
  },
  async ({ event, step }) => {
    const job_id = event.data.job_id as string;
    const admin = createAdminClient();

    const job = await step.run('synth-load-job', async () => {
      const { data, error } = await admin
        .from('trust_jobs')
        .select('id, tier, contractor_name_input, city, state_code, contractor_id, status')
        .eq('id', job_id)
        .single();
      if (error || !data) throw new Error(`load job failed: ${error?.message ?? 'not found'}`);
      return data;
    });

    if (job.status !== 'synthesizing') {
      return { skipped: true, reason: `job.status=${job.status}` };
    }

    // Tier 1 #2 — Trust-Synth-Guard. enqueue_trust_job populates contractor_id
    // atomically via contractors upsert, so a NULL here means something
    // bypassed the RPC. Fail the job cleanly instead of letting NULL
    // propagate into a hard PG crash mid-pipeline (e.g., score_and_finalize
    // would reject with not-null violation on contractor_trust_scores).
    if (!job.contractor_id) {
      await step.run('synth-guard-fail-no-contractor', async () => {
        const { error } = await admin
          .from('trust_jobs')
          .update({
            status: 'failed',
            error_message: 'missing_contractor_id_pre_synth',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job_id);
        if (error) console.warn('[synth-guard] mark-failed update error:', error.message);
      });
      console.warn('[synth-guard] tripped: missing_contractor_id_pre_synth', {
        job_id, status: job.status,
      });
      return { skipped: true, reason: 'missing_contractor_id_pre_synth' };
    }

    const tier = job.tier as SynthesisTier;
    const tierCfg = TIER_CONFIG[tier];
    if (!tierCfg) throw new Error(`unknown tier "${tier}"`);

    const score = await step.run('synth-compute-score', async () => {
      const { data, error } = await admin.rpc('calculate_contractor_trust_score', {
        p_job_id: job_id,
      });
      if (error || !data) throw new Error(`score RPC failed: ${error?.message ?? 'no row'}`);
      return data as ScoreContext;
    });

    const evidence = await step.run('synth-load-evidence', async () => {
      const { data, error } = await admin
        .from('trust_evidence')
        .select('id, source_key, sequence_number, finding_type, confidence, finding_summary')
        .eq('job_id', job_id)
        .order('sequence_number', { ascending: true });
      if (error) throw new Error(`evidence load failed: ${error.message}`);
      return (data ?? []) as EvidenceItem[];
    });

    // Tier 3 #1 commit 3: surface phoenix relationships to the LLM. Best-effort —
    // failures degrade to empty array, synthesis still runs with phoenix_score
    // alone (the score itself already drives buildFreeTierSynthesis fallback +
    // validator phoenix-mention requirement).
    const phoenixSignals = await step.run('synth-load-phoenix-signals', async () => {
      const { data, error } = await admin.rpc('detect_contractor_phoenix_signals_enriched', {
        p_contractor_id: job.contractor_id,
      });
      if (error) {
        console.warn('[synth-phoenix] detect_contractor_phoenix_signals_enriched failed', {
          job_id, contractor_id: job.contractor_id, error: error.message,
        });
        return [] as PhoenixSignal[];
      }
      return (Array.isArray(data) ? data : []) as PhoenixSignal[];
    });

    // PR #26 / Mode 3 fix — synth-generate is no longer a single big step.run.
    // Each LLM attempt is its own leaf step. The fallback cascade
    // (Opus → Sonnet → deterministic template) is orchestrated OUTSIDE step.run
    // so a watchdog timeout on Opus doesn't replay Opus on Inngest retry —
    // instead we fall through to the next attempt as a separate leaf step.
    let synthesisOutput: SynthesisOutput | null = null;
    let synthesisModel: string = tierCfg.model ?? 'free_tier_templated';
    let primaryStallElapsedMs: number | null = null;
    let sonnetStallElapsedMs: number | null = null;
    let totalCents = 0;

    if (!tierCfg.useLLM) {
      // Free tier — no LLM. Single-line synthesis.
      synthesisOutput = buildFreeTierSynthesis(score);
      synthesisModel = 'free_tier_templated';
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY missing');
      }

      const userPrompt = buildUserPrompt({
        contractorName: job.contractor_name_input,
        city: job.city,
        stateCode: String(job.state_code).trim(),
        score,
        evidence,
        phoenixSignals,
      });
      const systemPrompt = buildSystemPrompt();
      const tools = [SUBMIT_SYNTHESIS_TOOL as never];
      const toolChoice = { type: 'tool' as const, name: 'submit_synthesis' };

      // Diagnostics: stamp synthesis_started_at on the trust_jobs row.
      // Best-effort — column lands in migration 226. Non-fatal if absent.
      await markSynthesisStartedAt(admin, job_id);

      // Leaf step 1: primary tier model. callAnthropicWithWatchdog returns a
      // discriminated union (never throws on timeout/SDK error), so this step
      // body never throws and Inngest's function-level retries=2 won't replay
      // the LLM call. retries=0 by construction, not by config — Inngest 4.x
      // StepOptions doesn't expose per-step retries (see types.d.ts:StepOptions).
      const primaryTimeoutMs =
        tierCfg.model === 'claude-opus-4-7' ? OPUS_WATCHDOG_TIMEOUT_MS : SONNET_WATCHDOG_TIMEOUT_MS;
      const primaryAttempt = await step.run('synth-attempt-primary', async () => {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
        return callAnthropicWithWatchdog({
          client,
          model: tierCfg.model!,
          maxTokens: tierCfg.maxTokens,
          systemPrompt,
          userPrompt,
          tools,
          toolChoice,
          timeoutMs: primaryTimeoutMs,
        });
      });
      await incrementSynthesisAttemptCount(admin, job_id);

      if (primaryAttempt.kind === 'success') {
        try {
          synthesisOutput = parseSynthesisToolUse(primaryAttempt.response, evidence, score);
          totalCents = computeCostCents(primaryAttempt.response, tierCfg.model!);
        } catch (parseErr) {
          // Validator rejection — treat as a fall-through (try Sonnet) rather than
          // a thrown error. Throwing here would re-execute the entire function
          // including the cached LLM step on retry, wasting tokens.
          console.warn('[Watchdog] primary parse/validate failed; falling through', {
            job_id, error: (parseErr as Error)?.message,
          });
        }
      } else if (primaryAttempt.kind === 'timeout') {
        primaryStallElapsedMs = primaryAttempt.elapsedMs;
        console.warn(
          `[Watchdog] Primary synthesis stalled at ${primaryAttempt.elapsedMs}ms ` +
          `(timeout=${primaryAttempt.timeoutMs}ms, model=${tierCfg.model}, ` +
          `job_id=${job_id}). Falling back to Sonnet 4.6.`,
        );
      } else {
        // Non-timeout SDK error — log and fall through to fallback. The
        // pre-PR-26 code threw here, which (with Mode 1 no-onFailure) left
        // jobs stuck. We now have onFailure but a Sonnet retry is cheaper
        // than failing the job outright; if Sonnet also fails, the
        // deterministic template path always succeeds.
        console.error('[Watchdog] primary errored, attempting fallback', primaryAttempt.error);
      }

      // Leaf step 2: Sonnet fallback. Only meaningful when primary was Opus.
      if (!synthesisOutput && tierCfg.model === 'claude-opus-4-7') {
        const sonnetAttempt = await step.run('synth-attempt-sonnet', async () => {
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
          return callAnthropicWithWatchdog({
            client,
            model: 'claude-sonnet-4-6',
            maxTokens: tierCfg.maxTokens,
            systemPrompt,
            userPrompt,
            tools,
            toolChoice,
            timeoutMs: SONNET_WATCHDOG_TIMEOUT_MS,
          });
        });
        await incrementSynthesisAttemptCount(admin, job_id);

        if (sonnetAttempt.kind === 'success') {
          try {
            synthesisOutput = parseSynthesisToolUse(sonnetAttempt.response, evidence, score);
            synthesisModel = 'claude-sonnet-4-6-fallback';
            totalCents = computeCostCents(sonnetAttempt.response, 'claude-sonnet-4-6');
          } catch (parseErr) {
            console.warn('[Watchdog] sonnet parse/validate failed; falling through to template', {
              job_id, error: (parseErr as Error)?.message,
            });
          }
        } else if (sonnetAttempt.kind === 'timeout') {
          sonnetStallElapsedMs = sonnetAttempt.elapsedMs;
          console.error(
            `[Watchdog] Sonnet fallback also stalled at ${sonnetAttempt.elapsedMs}ms ` +
            `(job_id=${job_id}). Falling through to deterministic template.`,
          );
        } else {
          console.error('[Watchdog] Sonnet fallback errored:', sonnetAttempt.error);
        }
      }

      // Layer 3: deterministic template — always succeeds, never throws.
      // Counted as an attempt for diagnostics so attempt_count tells the full
      // cascade story (primary=1, +sonnet=2, +template=3).
      if (!synthesisOutput) {
        synthesisOutput = buildFreeTierSynthesis(score);
        await incrementSynthesisAttemptCount(admin, job_id);
        synthesisModel = sonnetStallElapsedMs != null
          ? 'templated_after_double_stall'
          : 'templated_after_stall';
      }

      // Cost-cap enforcement (only meaningful when an LLM ran).
      if (totalCents > 0 && totalCents > tierCfg.costCapCents) {
        throw new Error(`COST_CAP_EXCEEDED: ${totalCents.toFixed(2)}c > ${tierCfg.costCapCents}c`);
      }

      if (totalCents > 0) {
        await admin
          .from('trust_jobs')
          .update({ total_cost_cents: totalCents })
          .eq('id', job_id);
      }

      console.log(JSON.stringify({
        event: 'synthesis_complete',
        job_id,
        primary_model: tierCfg.model,
        final_model: synthesisModel,
        primary_stall_ms: primaryStallElapsedMs,
        sonnet_stall_ms: sonnetStallElapsedMs,
        fallback_used: synthesisModel !== tierCfg.model,
      }));
    }

    // Diagnostics: stamp synthesis_completed_at before finalize/mark-completed.
    // Captures the LLM cascade duration regardless of which layer succeeded.
    await markSynthesisCompletedAt(admin, job_id);

    if (!synthesisOutput) {
      // Unreachable — Layer 3 template never returns null. Belt + suspenders
      // so TS narrows the type below.
      throw new Error('synthesis pipeline produced no output');
    }
    const synthesis: SynthesisOutput = synthesisOutput;

    // Capture synthesisModel before passing into the closure — TS prefers
    // a stable reference inside step.run.
    const finalSynthesisModel = synthesisModel;
    const report = await step.run('synth-finalize-report', async () => {
      const { data: finalReport, error: finalErr } = await admin.rpc('score_and_finalize_trust_report', {
        p_job_id: job_id,
        p_summary: synthesis.summary,
        p_red_flags: synthesis.red_flags.map((rf) => rf.text),
        p_positive_indicators: synthesis.positives.map((pp) => pp.text),
        p_synthesis_model: finalSynthesisModel,
      });
      if (finalErr || !finalReport) throw new Error(`score_and_finalize failed: ${finalErr?.message ?? 'no row'}`);

      const reportRow = Array.isArray(finalReport) ? finalReport[0] : finalReport;
      if (!reportRow?.id) throw new Error('finalize returned no report id');

      const { error: projectErr } = await admin.rpc('trust_project_evidence_to_report', {
        p_report_id: reportRow.id,
      });
      if (projectErr) throw new Error(`trust_project_evidence_to_report failed: ${projectErr.message}`);

      return reportRow;
    });

    await step.run('synth-mark-completed', async () => {
      const { error } = await admin
        .from('trust_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          report_id: report.id,
        })
        .eq('id', job_id);
      if (error) throw new Error(`mark completed failed: ${error.message}`);
    });

    // Emit trust/report.created so the score-drop watch worker
    // (onTrustReportCreated) can compute delta vs prior history and
    // fan out dispatch rows to any user watching this contractor.
    // Re-fetch the report row to guarantee contractor_id + trust_score
    // are present in the event payload (RPC return shape isn't typed).
    const reportPayload = await step.run('load-report-for-event', async () => {
      const { data: row } = await admin
        .from('trust_reports')
        .select('id, contractor_id, trust_score')
        .eq('id', report.id)
        .single();
      return {
        report_id: report.id,
        job_id,
        contractor_id: row?.contractor_id ?? null,
        trust_score: row?.trust_score ?? null,
      };
    });
    await step.sendEvent('trust-report-created-emit', {
      name: 'trust/report.created',
      data: reportPayload,
    });

    return { job_id, reportId: report.id, tier, model: tierCfg.model ?? 'free_tier_templated' };
  },
);

// ---------------------------------------------------------------------------
// onTrustEvidenceAppended — watch-alert worker
// Triggered by 'trust/evidence.appended' fired from runTrustJobV2's scrape
// step. For each new alert-worthy finding type, finds active subscriptions
// matching the contractor and INSERTs trust_alert_dispatches rows with
// idempotency_key = sha256(evidence_id|subscription_id|channel) so retries
// don't duplicate alerts. Inline-dispatches via the channel-specific
// dispatcher so the user gets the alert in the same Inngest run.
// ---------------------------------------------------------------------------

const ALERT_WORTHY_FINDING_TYPES = new Set([
  'license_revoked',
  'license_suspended',
  'license_disciplinary_action',
  'license_revoked_but_operating',
  'civil_judgment_against',
  'osha_willful_citation',
  'osha_repeat_citation',
  'osha_fatality_finding',
  'sanction_hit',
  'phoenix_signal',
])

export const onTrustEvidenceAppended = inngest.createFunction(
  { id: 'on-trust-evidence-appended', triggers: [{ event: 'trust/evidence.appended' }], concurrency: { limit: 5 }, retries: 2 },
  async ({ event, step }) => {
    const { evidence_id, finding_type, source_key, job_id, contractor_id } = event.data as {
      evidence_id: string
      finding_type: string
      source_key: string
      job_id: string
      contractor_id: string
    }

    if (!ALERT_WORTHY_FINDING_TYPES.has(finding_type)) {
      return { skipped: true, reason: 'finding_type_not_alert_worthy', finding_type }
    }

    const admin = createAdminClient()

    const subs = await step.run('load-active-subscriptions', async () => {
      const { data, error } = await admin
        .from('trust_watch_subscriptions')
        .select('id, user_id, channels, notify_on_finding_types')
        .eq('contractor_id', contractor_id)
        .eq('active', true)
      if (error) throw new Error(`load subscriptions: ${error.message}`)
      return (data ?? []) as Array<{
        id: string; user_id: string; channels: string[]; notify_on_finding_types: string[]
      }>
    })

    if (subs.length === 0) {
      return { skipped: true, reason: 'no_active_subscriptions', evidence_id }
    }

    const dispatchIds: string[] = []
    for (const sub of subs) {
      if (!sub.notify_on_finding_types?.includes(finding_type)) continue
      for (const channel of sub.channels ?? ['email']) {
        const idemKey = await step.run(`compute-idem-${sub.id}-${channel}`, async () => {
          const { createHash } = await import('node:crypto')
          return createHash('sha256').update(`${evidence_id}|${sub.id}|${channel}`).digest('hex')
        })

        const inserted = await step.run(`insert-dispatch-${sub.id}-${channel}`, async () => {
          // Look up contractor name for the payload.
          const { data: contractor } = await admin
            .from('contractors')
            .select('legal_name')
            .eq('id', contractor_id)
            .single()
          // Look up evidence summary for the payload.
          const { data: evidence } = await admin
            .from('trust_evidence')
            .select('finding_summary')
            .eq('id', evidence_id)
            .single()
          const payload = {
            contractor_id,
            contractor_name: contractor?.legal_name ?? null,
            finding_type,
            finding_summary: evidence?.finding_summary ?? '',
            source_key,
            evidence_id,
            job_id,
          }
          const { data, error } = await admin
            .from('trust_alert_dispatches')
            .upsert(
              {
                subscription_id: sub.id,
                evidence_id,
                trigger_type: 'finding_type',
                payload,
                channel,
                idempotency_key: idemKey,
              },
              { onConflict: 'idempotency_key', ignoreDuplicates: false },
            )
            .select('id, dispatch_status')
            .single()
          if (error) throw new Error(`insert dispatch: ${error.message}`)
          return data
        })

        if (inserted?.dispatch_status === 'pending') {
          dispatchIds.push(inserted.id)
          await step.run(`dispatch-${channel}-${inserted.id}`, async () => {
            if (channel === 'email') {
              const { dispatchAlertEmail } = await import('./notify/email')
              return dispatchAlertEmail(inserted.id)
            }
            if (channel === 'sms') {
              const { dispatchAlertSms } = await import('./notify/sms')
              return dispatchAlertSms(inserted.id)
            }
            return { status: 'suppressed', reason: `unknown_channel_${channel}` }
          })
        }
      }

      await step.run(`update-last-alerted-${sub.id}`, async () => {
        await admin
          .from('trust_watch_subscriptions')
          .update({ last_alerted_at: new Date().toISOString() })
          .eq('id', sub.id)
      })
    }

    return { evidence_id, dispatched: dispatchIds.length }
  },
)

// ---------------------------------------------------------------------------
// onTrustReportCreated — score-drop watch worker
// Triggered by 'trust/report.created' fired at end of runTrustSynthesizeV2.
// Computes delta vs the most-recent prior trust_score_history row for the
// same contractor; if any subscription has notify_on_score_drop_threshold
// set AND the (negative) delta meets the threshold, fans out dispatch
// rows. Idempotency_key = sha256(report_id|subscription_id|channel).
// ---------------------------------------------------------------------------

export const onTrustReportCreated = inngest.createFunction(
  { id: 'on-trust-report-created', triggers: [{ event: 'trust/report.created' }], concurrency: { limit: 5 }, retries: 2 },
  async ({ event, step }) => {
    const { report_id, contractor_id, trust_score } = event.data as {
      report_id: string
      contractor_id: string | null
      trust_score: number | null
    }

    if (!contractor_id || trust_score === null) {
      return { skipped: true, reason: 'missing_contractor_or_score' }
    }

    const admin = createAdminClient()

    const priorScore = await step.run('load-prior-score', async () => {
      const { data, error } = await admin
        .from('trust_score_history')
        .select('trust_score, captured_at')
        .eq('contractor_id', contractor_id)
        .neq('source_report_id', report_id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`load prior score: ${error.message}`)
      return data?.trust_score ?? null
    })

    if (priorScore === null) {
      return { skipped: true, reason: 'no_prior_history' }
    }

    const delta = trust_score - priorScore
    if (delta >= 0) {
      return { skipped: true, reason: 'score_did_not_drop', delta }
    }
    const dropMagnitude = -delta // positive number

    const subs = await step.run('load-score-drop-subscriptions', async () => {
      const { data, error } = await admin
        .from('trust_watch_subscriptions')
        .select('id, user_id, channels, notify_on_score_drop_threshold')
        .eq('contractor_id', contractor_id)
        .eq('active', true)
        .not('notify_on_score_drop_threshold', 'is', null)
      if (error) throw new Error(`load subs: ${error.message}`)
      return (data ?? []).filter((s: { notify_on_score_drop_threshold: number | null }) =>
        (s.notify_on_score_drop_threshold ?? 0) > 0
        && dropMagnitude >= (s.notify_on_score_drop_threshold ?? Infinity)
      ) as Array<{ id: string; user_id: string; channels: string[]; notify_on_score_drop_threshold: number }>
    })

    if (subs.length === 0) {
      return { skipped: true, reason: 'no_subs_match_threshold', delta }
    }

    const dispatchIds: string[] = []
    for (const sub of subs) {
      for (const channel of sub.channels ?? ['email']) {
        const idemKey = await step.run(`compute-idem-${sub.id}-${channel}`, async () => {
          const { createHash } = await import('node:crypto')
          return createHash('sha256').update(`${report_id}|${sub.id}|${channel}`).digest('hex')
        })

        const inserted = await step.run(`insert-dispatch-${sub.id}-${channel}`, async () => {
          const { data: contractor } = await admin
            .from('contractors')
            .select('legal_name')
            .eq('id', contractor_id)
            .single()
          const payload = {
            contractor_id,
            contractor_name: contractor?.legal_name ?? null,
            prior_score: priorScore,
            current_score: trust_score,
            delta,
            report_id,
          }
          const { data, error } = await admin
            .from('trust_alert_dispatches')
            .upsert(
              {
                subscription_id: sub.id,
                evidence_id: null,
                trigger_type: 'score_drop',
                payload,
                channel,
                idempotency_key: idemKey,
              },
              { onConflict: 'idempotency_key', ignoreDuplicates: false },
            )
            .select('id, dispatch_status')
            .single()
          if (error) throw new Error(`insert dispatch: ${error.message}`)
          return data
        })

        if (inserted?.dispatch_status === 'pending') {
          dispatchIds.push(inserted.id)
          await step.run(`dispatch-${channel}-${inserted.id}`, async () => {
            if (channel === 'email') {
              const { dispatchAlertEmail } = await import('./notify/email')
              return dispatchAlertEmail(inserted.id)
            }
            if (channel === 'sms') {
              const { dispatchAlertSms } = await import('./notify/sms')
              return dispatchAlertSms(inserted.id)
            }
            return { status: 'suppressed', reason: `unknown_channel_${channel}` }
          })
        }
      }
    }

    return { report_id, delta, dispatched: dispatchIds.length }
  },
)

