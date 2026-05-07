/**
 * runTrustOrchestratorV2 — single function all tiers route through.
 *
 * Behavior matrix:
 *   - opts.runSynthesis=false (free tier): scrapers → evidence → templated
 *     report inline. Caller awaits the full pipeline. Result includes the
 *     finished trust_reports row.
 *   - opts.runSynthesis=true  (paid tiers): scrapers → evidence → emit
 *     'trust/job.synthesize.requested'. Synthesis runs as a separate Inngest
 *     function (runTrustSynthesizeV2). Result includes job_id only.
 *
 * Step-aware: when invoked from runTrustJobV2 we pass the Inngest `step`
 * object so each scraper call is a durable step.run boundary. When invoked
 * from a sync HTTP path (free tier) we pass undefined and the orchestrator
 * runs the body inline.
 *
 * Job row provenance:
 *   - If input.jobId is provided (Inngest path), use it as-is.
 *   - Otherwise (sync free tier), create one via enqueue_trust_job RPC. The
 *     row provides the jobId required by persist-evidence's append_trust_evidence
 *     RPC for hash-chain bookkeeping.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { runScraper } from './scrapers/registry'
import { persistEvidence } from './scrapers/persist-evidence'
import type { ScraperEvidence } from './scrapers/types'
import { buildEvidenceDerivedReport, type EvidenceDerivedReport } from './build-evidence-derived-report'
import type { Tier } from './tier-config'

export interface OrchestratorInput {
  contractor_name: string
  state_code: string
  city?: string | null
  requested_by_user_id?: string | null
  /** Provided when invoked from runTrustJobV2; null/undefined for sync free path. */
  jobId?: string | null
}

export interface OrchestratorOpts {
  tier: Tier
  runSynthesis: boolean
  scraperKeys: string[]
  synthesisModel: string | null
  /** Top-N name variants. PR #25 fills this with real variants; today the
   *  caller passes a single-element array containing the input name. */
  nameVariants: string[]
}

/** Subset of Inngest's `step` we actually use. Inngest's `step.run` JSON-
 *  serializes return values, which TS exposes as `Jsonify<Awaited<T>>` rather
 *  than `T`. We pass through with `unknown` and rely on the call sites to
 *  cast — this lets the same orchestrator interface accept Inngest's `step`
 *  without bringing @inngest/sdk types into the sync HTTP path. */
export interface OrchestratorStepLike {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>
  sendEvent: (id: string, event: { name: string; data: unknown } | Array<{ name: string; data: unknown }>) => Promise<unknown>
}

export type OrchestratorResult =
  | {
      kind: 'sync_complete'
      job_id: string
      report_id: string
      report: EvidenceDerivedReport & { id: string; contractor_name: string; city: string | null; state_code: string; tier: string; created_at: string }
    }
  | {
      kind: 'synthesis_pending'
      job_id: string
    }

/**
 * Execute the orchestrator. See module header for behavior matrix.
 */
export async function runTrustOrchestratorV2(
  input: OrchestratorInput,
  opts: OrchestratorOpts,
  step?: OrchestratorStepLike,
): Promise<OrchestratorResult> {
  const admin = createAdminClient()

  const wrap = async <T>(id: string, fn: () => Promise<T>): Promise<T> => {
    if (step) return (await step.run(id, fn)) as T
    return fn()
  }

  const jobId = input.jobId ?? (await ensureJobRow(admin, input, opts.tier))

  // Resolve / create contractor row
  const contractorRow = await wrap('orch-resolve-contractor', async () => {
    const { data, error } = await admin.rpc('resolve_or_create_contractor', {
      p_legal_name: input.contractor_name,
      p_state_code: input.state_code,
      p_city: input.city ?? null,
    })
    if (error) throw new Error(`resolve_or_create_contractor: ${error.message}`)
    if (data?.id) {
      await admin.from('trust_jobs').update({ contractor_id: data.id }).eq('id', jobId)
    }
    return data as { id: string } | null
  })

  // Mark running + plan counters
  await wrap('orch-mark-running', async () => {
    await admin
      .from('trust_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        total_sources_planned: opts.scraperKeys.length,
      })
      .eq('id', jobId)
  })

  // Run scrapers serially per-job (the (job_id, sequence_number) unique
  // index in trust_evidence forbids parallel inserts within a job; cross-job
  // parallelism is provided by Inngest's concurrency cap upstream).
  let completed = 0
  let failed = 0
  const primaryName = opts.nameVariants[0] ?? input.contractor_name

  for (const sourceKey of opts.scraperKeys) {
    const result = await wrap(`orch-scrape-${sourceKey}`, async () => {
      try {
        const findings = await runScraper(sourceKey, {
          legalName: primaryName,
          stateCode: input.state_code,
          city: input.city ?? null,
        })
        const evidenceIds: string[] = []
        const emittedFindings: Array<{ evidence_id: string; finding_type: string }> = []
        for (const f of findings) {
          const persisted = await persistEvidence({
            jobId,
            contractorId: contractorRow?.id ?? null,
            evidence: f,
            supabase: admin as unknown as SupabaseClient,
          })
          evidenceIds.push(persisted.evidenceId)
          emittedFindings.push({ evidence_id: persisted.evidenceId, finding_type: f.finding_type })
        }
        return { ok: true as const, sourceKey, evidenceIds, findingCount: findings.length, emittedFindings }
      } catch (err) {
        const errorEvidence: ScraperEvidence = {
          source_key: sourceKey,
          finding_type: 'source_error',
          confidence: 'low_inference',
          finding_summary: `Scraper failed for ${sourceKey}: ${String((err as Error)?.message ?? err).slice(0, 300)}`,
          extracted_facts: { error_class: (err as { constructor?: { name?: string } })?.constructor?.name ?? 'Error' },
          query_sent: null,
          response_sha256: null,
          response_snippet: null,
          duration_ms: 0,
          cost_cents: 0,
        }
        await persistEvidence({
          jobId,
          contractorId: contractorRow?.id ?? null,
          evidence: errorEvidence,
          supabase: admin as unknown as SupabaseClient,
        })
        return { ok: false as const, sourceKey, error: String((err as Error)?.message ?? err) }
      }
    })

    if (result.ok) {
      completed += 1
      // Emit evidence-appended events so the watch-alert worker can fan out.
      // Step-aware paths use step.sendEvent so the dispatch is durable;
      // sync paths fall back to inngest.send (best-effort, non-fatal).
      if (result.emittedFindings.length > 0 && contractorRow?.id) {
        const events = result.emittedFindings.map((ef) => ({
          name: 'trust/evidence.appended',
          data: {
            evidence_id: ef.evidence_id,
            finding_type: ef.finding_type,
            source_key: sourceKey,
            job_id: jobId,
            contractor_id: contractorRow.id,
          },
        }))
        if (step) {
          await step.sendEvent(`orch-evidence-appended-${sourceKey}`, events)
        } else {
          try {
            await inngest.send(events)
          } catch (sendErr) {
            console.warn('[orchestrator-v2] inngest.send (evidence.appended) failed (non-fatal)', sendErr)
          }
        }
      }
    } else {
      failed += 1
    }
  }

  // Update counters
  await wrap('orch-update-counters', async () => {
    const { count } = await admin
      .from('trust_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
    await admin
      .from('trust_jobs')
      .update({
        status: opts.runSynthesis ? 'synthesizing' : 'running',
        sources_completed: completed,
        sources_failed: failed,
        evidence_count: count ?? completed + failed,
      })
      .eq('id', jobId)
  })

  if (opts.runSynthesis) {
    // Hand off to runTrustSynthesizeV2.
    if (step) {
      await step.sendEvent('orch-synthesize-emit', {
        name: 'trust/job.synthesize.requested',
        data: { job_id: jobId },
      })
    } else {
      try {
        await inngest.send({
          name: 'trust/job.synthesize.requested',
          data: { job_id: jobId },
        })
      } catch (sendErr) {
        console.error('[orchestrator-v2] inngest.send synthesize failed', sendErr)
      }
    }
    return { kind: 'synthesis_pending', job_id: jobId }
  }

  // Sync free path: read the evidence we just wrote, build a templated
  // report, persist trust_reports, mark job completed.
  return finalizeFreeTier(admin, input, opts, jobId)
}

/**
 * Sync free-tier finalization: read evidence rows, build templated report,
 * INSERT trust_reports row, update trust_jobs.status='completed'.
 */
async function finalizeFreeTier(
  admin: SupabaseClient,
  input: OrchestratorInput,
  opts: OrchestratorOpts,
  jobId: string,
): Promise<OrchestratorResult> {
  const { data: evidenceRows, error: evidenceErr } = await admin
    .from('trust_evidence')
    .select('source_key, finding_type, confidence, finding_summary, extracted_facts')
    .eq('job_id', jobId)

  if (evidenceErr) throw new Error(`finalizeFreeTier: read evidence: ${evidenceErr.message}`)

  const evidence: ScraperEvidence[] = (evidenceRows ?? []).map((r) => ({
    source_key: r.source_key,
    finding_type: r.finding_type,
    confidence: r.confidence,
    finding_summary: r.finding_summary,
    extracted_facts: (r.extracted_facts as Record<string, unknown>) ?? {},
    query_sent: null,
    response_sha256: null,
    response_snippet: null,
    duration_ms: 0,
    cost_cents: 0,
  }))

  const derived = buildEvidenceDerivedReport(evidence)

  const { data: insertedReport, error: insertErr } = await admin
    .from('trust_reports')
    .insert({
      user_id: input.requested_by_user_id ?? null,
      contractor_name: input.contractor_name,
      city: input.city ?? null,
      state_code: input.state_code,
      tier: opts.tier,
      job_id: jobId,
      trust_score: derived.trust_score,
      risk_level: derived.risk_level,
      confidence_level: derived.confidence_level,
      biz_status: derived.biz_status,
      biz_entity_type: derived.biz_entity_type,
      biz_formation_date: derived.biz_formation_date,
      lic_status: derived.lic_status,
      lic_license_number: derived.lic_license_number,
      bbb_rating: derived.bbb_rating,
      bbb_accredited: derived.bbb_accredited,
      bbb_complaint_count: derived.bbb_complaint_count,
      legal_status: derived.legal_status,
      legal_findings: derived.legal_findings,
      osha_status: derived.osha_status,
      osha_violation_count: derived.osha_violation_count,
      osha_serious_count: derived.osha_serious_count,
      red_flags: derived.red_flags,
      positive_indicators: derived.positive_indicators,
      summary: derived.summary,
      data_sources_searched: derived.data_sources_searched,
      data_integrity_status: derived.data_integrity_status,
      synthesis_model: derived.synthesis_model,
      searches_performed: derived.data_sources_searched.length,
    })
    .select('id, created_at')
    .single()

  if (insertErr || !insertedReport) {
    throw new Error(`finalizeFreeTier: insert trust_reports: ${insertErr?.message ?? 'no row returned'}`)
  }

  await admin
    .from('trust_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      report_id: insertedReport.id,
    })
    .eq('id', jobId)

  return {
    kind: 'sync_complete',
    job_id: jobId,
    report_id: insertedReport.id,
    report: {
      ...derived,
      id: insertedReport.id,
      contractor_name: input.contractor_name,
      city: input.city ?? null,
      state_code: input.state_code,
      tier: opts.tier,
      created_at: insertedReport.created_at as string,
    },
  }
}

/**
 * Create a trust_jobs row for sync free-tier callers via enqueue_trust_job
 * RPC. Mirrors the call shape used by /api/trust/lookup/anon.
 */
async function ensureJobRow(
  admin: SupabaseClient,
  input: OrchestratorInput,
  tier: Tier,
): Promise<string> {
  const { data, error } = await admin.rpc('enqueue_trust_job', {
    p_contractor_name: input.contractor_name,
    p_state_code: input.state_code,
    p_city: input.city ?? null,
    p_tier: tier,
    p_user_id: input.requested_by_user_id ?? null,
    p_credit_id: null,
    p_idempotency_key: null,
  })

  if (error) throw new Error(`ensureJobRow: enqueue_trust_job: ${error.message}`)
  const jobRow = Array.isArray(data) ? data[0] : data
  if (!jobRow?.id) throw new Error('ensureJobRow: enqueue_trust_job returned no id')
  return jobRow.id as string
}
