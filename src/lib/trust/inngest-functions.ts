import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { persistEvidence } from './scrapers/persist-evidence'
import { runScraper } from './scrapers/registry'
import { sourcesForTier } from './scrapers/tier-sources-loader'
import Anthropic from '@anthropic-ai/sdk';
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

// Tranche A: mock orchestration spine. One Inngest function consumes
// trust/job.enqueued events, runs a single mock scraper, finalizes the
// trust_reports row via score_and_finalize_trust_report, and projects
// evidence_ids → typed columns. Tranche B replaces the mock scraper with
// real source workers (SAM.gov, OSHA, CourtListener, etc.).
export const runTrustJob = inngest.createFunction(
  {
    id:          'trust-job-runner',
    triggers:    [{ event: 'trust/job.enqueued' }],
    concurrency: { limit: 5 },
    retries:     2,
  },
  async ({ event, step }) => {
    const job_id = event.data?.job_id as string | undefined
    if (!job_id) throw new Error('runTrustJob: missing job_id in event payload')

    const admin = createAdminClient()

    try {
      // 1. Load the job row
      const job = await step.run('load-job', async () => {
        const { data, error } = await admin
          .from('trust_jobs')
          .select('*')
          .eq('id', job_id)
          .maybeSingle()
        if (error) throw new Error(`load-job query: ${error.message}`)
        if (!data)  throw new Error(`load-job: trust_jobs ${job_id} not found`)
        return data
      })

      // 2. queued → running (idempotent — predicate guards against re-runs)
      await step.run('mark-running', async () => {
        const { error } = await admin
          .from('trust_jobs')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', job_id)
          .eq('status', 'queued')
        if (error) throw new Error(`mark-running update: ${error.message}`)
      })

      // 3. Mock scraper: one verified_structured business_active evidence row
      await step.run('scraper-mock', async () => {
        const { error } = await admin.rpc('append_trust_evidence', {
          p_job_id:          job_id,
          p_contractor_id:   job.contractor_id,
          p_source_key:      'mock_source',
          p_finding_type:    'business_active',
          p_confidence:      'verified_structured',
          p_finding_summary: `${job.contractor_name_input} verified in mock data (orchestration test)`,
          p_extracted_facts: { status: 'Active', entity_type: 'LLC', formation_date: '2020-01-01' },
          p_duration_ms:     100,
          p_cost_cents:      0,
          p_source_errored:  false,
        })
        if (error) throw new Error(`append_trust_evidence: ${error.message}`)
      })

      // 4. Counter bookkeeping + running → synthesizing
      await step.run('update-counters', async () => {
        const { error } = await admin
          .from('trust_jobs')
          .update({
            total_sources_planned: 1,
            sources_completed:     1,
            evidence_count:        1,
            status:                'synthesizing',
          })
          .eq('id', job_id)
        if (error) throw new Error(`update-counters: ${error.message}`)
      })

      // 5. Score + finalize (RPC writes trust_reports row and flips job → completed)
      const report = await step.run('score-and-finalize', async () => {
        const { data, error } = await admin.rpc('score_and_finalize_trust_report', {
          p_job_id:              job_id,
          p_summary:             `Async orchestration test for ${job.contractor_name_input}. 1 source verified.`,
          p_red_flags:           [],
          p_positive_indicators: ['Async orchestration spine completed'],
          p_synthesis_model:     'mock-orchestrator-v0',
        })
        if (error) throw new Error(`score_and_finalize_trust_report: ${error.message}`)
        const row = Array.isArray(data) ? data[0] : data
        if (!row?.id) throw new Error('score_and_finalize_trust_report returned no report id')
        return row
      })

      // 6. Project evidence_ids → typed columns on the trust_reports row
      await step.run('project-evidence', async () => {
        const { error } = await admin.rpc('trust_project_evidence_to_report', {
          p_report_id: report.id,
        })
        if (error) throw new Error(`trust_project_evidence_to_report: ${error.message}`)
      })

      return { job_id, report_id: report.id, ok: true }
    } catch (err) {
      // Mark job failed and rethrow so Inngest records the run as failed.
      // Note: this fires on every attempt (not just terminal). Successful
      // retries will re-transition status via update-counters and the
      // score_and_finalize RPC, so the final persisted state reflects the
      // last successful attempt. Polling clients can observe a transient
      // 'failed' between retries.
      const errMsg = err instanceof Error ? err.message : String(err)
      await admin
        .from('trust_jobs')
        .update({
          status:        'failed',
          error_message: errMsg,
          completed_at:  new Date().toISOString(),
        })
        .eq('id', job_id)
      throw err
    }
  },
)

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

    // 1. Load job + tier + contractor identity
    const job = await step.run('v2-load-job', async () => {
      const { data, error } = await admin
        .from('trust_jobs')
        .select('id, tier, contractor_name:contractor_name_input, state_code, city, contractor_id')
        .eq('id', job_id)
        .single()
      if (error) throw new Error(`v2-load-job: ${error.message}`)
      return data
    })

    // 2. Resolve or create contractor row, link to job
    const contractorRow = await step.run('v2-resolve-contractor', async () => {
      const { data, error } = await admin.rpc('resolve_or_create_contractor', {
        p_legal_name: job.contractor_name,
        p_state_code: job.state_code,
        p_city: job.city,
      })
      if (error) throw new Error(`v2-resolve-contractor: ${error.message}`)
      if (!job.contractor_id && data?.id) {
        await admin.from('trust_jobs').update({ contractor_id: data.id }).eq('id', job_id)
      }
      return data
    })

    // 3. Determine sources for this tier (DB-driven via migration 200; cached after cold boot).
    const sources = await sourcesForTier(job.tier, job.state_code)

    // 4. Mark running + plan counters
    await step.run('v2-mark-running', async () => {
      await admin
        .from('trust_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          total_sources_planned: sources.length,
        })
        .eq('id', job_id)
    })

    // 5. Fan out scrapers serially within the function (per-job).
    //    Serial because persistEvidence sequence_number requires per-job
    //    ordering; the (job_id, sequence_number) unique index would reject
    //    parallel inserts. Concurrency 5 across DIFFERENT jobs is the parallelism.
    let completed = 0
    let failed = 0
    for (const sourceKey of sources) {
      const result = await step.run(`v2-scrape-${sourceKey}`, async () => {
        try {
          const findings = await runScraper(sourceKey, {
            legalName: job.contractor_name,
            stateCode: job.state_code,
            city: job.city,
          })
          // Multi-finding scrapers (e.g. permit history) emit several rows
          // per source. Persist each finding via the same chain — sequence
          // numbers are assigned atomically by append_trust_evidence RPC.
          const evidenceIds: string[] = []
          const emittedFindings: Array<{ evidence_id: string; finding_type: string }> = []
          for (const f of findings) {
            const persisted = await persistEvidence({
              jobId: job_id,
              contractorId: contractorRow?.id ?? null,
              evidence: f,
              supabase: admin as any,
            })
            evidenceIds.push(persisted.evidenceId)
            emittedFindings.push({ evidence_id: persisted.evidenceId, finding_type: f.finding_type })
          }
          return { ok: true as const, evidenceIds, sourceKey, findingCount: findings.length, emittedFindings, contractorId: contractorRow?.id ?? null }
        } catch (err: any) {
          const errorEvidence = {
            source_key: sourceKey,
            finding_type: 'source_error' as const,
            confidence: 'low_inference' as const,
            finding_summary: `Scraper failed for ${sourceKey}: ${String(err?.message ?? err).slice(0, 300)}`,
            extracted_facts: { error_class: err?.constructor?.name ?? 'Error' },
            query_sent: null,
            response_sha256: null,
            response_snippet: null,
            duration_ms: 0,
            cost_cents: 0,
          }
          await persistEvidence({
            jobId: job_id,
            contractorId: contractorRow?.id ?? null,
            evidence: errorEvidence,
            supabase: admin as any,
          })
          return { ok: false as const, sourceKey, error: String(err?.message ?? err) }
        }
      })
      if (result.ok) {
        completed += 1
        // Emit one trust/evidence.appended event per finding so the
        // watch-alert worker (onTrustEvidenceAppended) can fan out
        // dispatch rows for any user watching this contractor. Cheap —
        // alert-worthy filter is applied inside the worker, not here.
        if (result.emittedFindings && result.emittedFindings.length > 0 && result.contractorId) {
          await step.sendEvent(`trust-evidence-appended-${sourceKey}`, result.emittedFindings.map((ef: { evidence_id: string; finding_type: string }) => ({
            name: 'trust/evidence.appended',
            data: {
              evidence_id: ef.evidence_id,
              finding_type: ef.finding_type,
              source_key: sourceKey,
              job_id,
              contractor_id: result.contractorId,
            },
          })))
        }
      }
      else failed += 1
    }

    await step.run('v2-update-counters', async () => {
      const { count } = await admin
        .from('trust_evidence')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job_id)
      await admin
        .from('trust_jobs')
        .update({
          status: 'synthesizing',
          sources_completed: completed,
          sources_failed: failed,
          evidence_count: count ?? completed + failed,
        })
        .eq('id', job_id)
    })

    await step.sendEvent('trust-synthesize-emit', {
      name: 'trust/job.synthesize.requested',
      data: { job_id },
    })

    return { job_id, sources_attempted: sources.length, completed, failed }
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

    const synthesis: SynthesisOutput = await step.run('synth-generate', async () => {
      if (!tierCfg.useLLM) {
        return buildFreeTierSynthesis(score);
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY missing');
      }
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const resp = await client.messages.create({
        model: tierCfg.model!,
        max_tokens: tierCfg.maxTokens,
        temperature: 0,
        system: buildSystemPrompt(),
        tools: [SUBMIT_SYNTHESIS_TOOL as never],
        tool_choice: { type: 'tool', name: 'submit_synthesis' },
        messages: [
          {
            role: 'user',
            content: buildUserPrompt({
              contractorName: job.contractor_name_input,
              city: job.city,
              stateCode: String(job.state_code).trim(),
              score,
              evidence,
              phoenixSignals,
            }),
          },
        ],
      });

      const inputCostMicrocents = resp.usage.input_tokens * (tierCfg.model === 'claude-opus-4-7' ? 500 : 300);
      const outputCostMicrocents = resp.usage.output_tokens * (tierCfg.model === 'claude-opus-4-7' ? 2500 : 1500);
      const totalCents = (inputCostMicrocents + outputCostMicrocents) / 1_000_000 * 100;
      if (totalCents > tierCfg.costCapCents) {
        throw new Error(`COST_CAP_EXCEEDED: ${totalCents.toFixed(2)}c > ${tierCfg.costCapCents}c`);
      }

      const toolBlock = resp.content.find((b) => b.type === 'tool_use' && b.name === 'submit_synthesis');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error(`Anthropic did not return submit_synthesis tool_use; stop_reason=${resp.stop_reason}`);
      }

      const validation = validateSynthesis(toolBlock.input, evidence, score);
      if (!validation.ok) {
        throw new Error(`validator rejected synthesis: ${validation.errors.join('; ')}`);
      }

      await admin
        .from('trust_jobs')
        .update({ total_cost_cents: totalCents })
        .eq('id', job_id);

      return validation.output;
    });

    const report = await step.run('synth-finalize-report', async () => {
      const synthesisModel = tierCfg.useLLM ? (tierCfg.model ?? 'unknown') : 'free_tier_templated';
      const { data: finalReport, error: finalErr } = await admin.rpc('score_and_finalize_trust_report', {
        p_job_id: job_id,
        p_summary: synthesis.summary,
        p_red_flags: synthesis.red_flags.map((rf) => rf.text),
        p_positive_indicators: synthesis.positives.map((pp) => pp.text),
        p_synthesis_model: synthesisModel,
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

