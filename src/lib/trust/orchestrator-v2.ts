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
import type { ScraperEvidence, EntityCandidate } from './scrapers/types'
import { buildEvidenceDerivedReport, type EvidenceDerivedReport } from './build-evidence-derived-report'
import type { Tier } from './tier-config'
import { ENTITY_REGISTRY_SCRAPERS, OPEN_WEB_CONFIG } from './tier-config'
import { searchCoSosCandidates } from './scrapers/co-sos-biz'
import { searchTxSosCandidates } from './scrapers/tx-sos-biz'
import { rankCandidates } from './name-similarity'
import { scrapePerplexitySweep } from './scrapers/perplexity-sweep'
import { scrapeClaudeWebSearchVerify } from './scrapers/claude-web-search'
import { detectCrossEngineCorroboration } from './cross-engine-corroboration'
import { detectPhoenixPattern, relatedEntitiesToEvidence, type CanonicalEntity } from './scrapers/phoenix-detector'

export interface OrchestratorInput {
  contractor_name: string
  state_code: string
  city?: string | null
  requested_by_user_id?: string | null
  /** Provided when invoked from runTrustJobV2; null/undefined for sync free path. */
  jobId?: string | null
  /**
   * 227: when the user clicked through entity disambiguation, the original
   * typed query (different from the canonical legal name now in
   * contractor_name). Triggers an early name_discrepancy_observed evidence
   * row + drives the report's name_discrepancy fraud-flag projection.
   */
  searched_as?: string | null
  /** 227: entity_id provided by click-through. Recorded in raw_report.business
   *  for audit. */
  entity_id_from_click?: string | null
  /** 227: source_key the entity_id came from (e.g. 'co_sos_biz'). */
  entity_source_from_click?: string | null
}

/** Maps source_key → candidate-search function. Keep narrow — every entry
 *  here also needs to be in ENTITY_REGISTRY_SCRAPERS. */
const CANDIDATE_SEARCH_DISPATCH: Record<
  string,
  (input: { legalName: string }, limit?: number) => Promise<EntityCandidate[]>
> = {
  co_sos_biz: (input, limit) => searchCoSosCandidates(input, limit),
  tx_sos_biz: (input, limit) => searchTxSosCandidates(input, limit),
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

  // 227: name-discrepancy injection. Click-through path passes searched_as
  // (the user's original typed query) when the canonical legal name from
  // their candidate selection differs. Record an evidence row BEFORE any
  // scraper runs so the chain captures the discrepancy at the head of the
  // job's history. Builder projects this into red_flags +
  // raw_report.name_discrepancy.
  if (
    input.searched_as &&
    input.searched_as.trim().length > 0 &&
    input.searched_as.trim().toLowerCase() !== input.contractor_name.trim().toLowerCase()
  ) {
    await wrap('orch-name-discrepancy', async () => {
      await persistEvidence({
        jobId,
        contractorId: contractorRow?.id ?? null,
        evidence: {
          source_key: 'system_internal',
          finding_type: 'name_discrepancy_observed',
          confidence: 'verified_structured',
          finding_summary:
            `Contractor was solicited as "${input.searched_as}" but their canonical legal entity is registered as "${input.contractor_name}". ` +
            `Name discrepancies in contractor solicitations are an independent fraud indicator.`,
          extracted_facts: {
            searched_as: input.searched_as,
            canonical_name: input.contractor_name,
            entity_id_from_click: input.entity_id_from_click ?? null,
            entity_source_from_click: input.entity_source_from_click ?? null,
          },
          query_sent: null,
          response_sha256: null,
          response_snippet: null,
          duration_ms: 0,
          cost_cents: 0,
        },
        supabase: admin as unknown as SupabaseClient,
      })
    })
  }

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
          nameVariants: opts.nameVariants,
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

  // 227: disambiguation fallback. If the exact-match scraper round produced
  // no business_active/inactive/dissolved finding (entity_not_found shape),
  // ask each registered entity-registry scraper for similar candidates by
  // name. Opportunistic — failures swallowed inside searchCoSosCandidates /
  // searchTxSosCandidates (return []). Skipped when the user came in via a
  // click-through (entity_id_from_click present) since they already picked.
  if (!input.entity_id_from_click) {
    await wrap('orch-disambiguation', async () => {
      try {
        const exactMatchHit = await admin
          .from('trust_evidence')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .in('finding_type', [
            'business_active', 'business_inactive', 'business_dissolved',
          ])
        const hitCount = exactMatchHit.count ?? 0
        if (hitCount > 0) return // exact match found, no need to disambiguate

        const registryKeys = opts.scraperKeys.filter((k) =>
          (ENTITY_REGISTRY_SCRAPERS as readonly string[]).includes(k) &&
          typeof CANDIDATE_SEARCH_DISPATCH[k] === 'function',
        )
        if (registryKeys.length === 0) return

        const batches = await Promise.allSettled(
          registryKeys.map((k) =>
            CANDIDATE_SEARCH_DISPATCH[k]({ legalName: primaryName }, 20),
          ),
        )
        const allCandidates: EntityCandidate[] = batches
          .filter((r): r is PromiseFulfilledResult<EntityCandidate[]> => r.status === 'fulfilled')
          .flatMap((r) => r.value)
        if (allCandidates.length === 0) return

        // Re-rank across the merged set. Each scraper already returned its
        // own top-5 ranked locally; rankCandidates strips
        // already-attached similarity_score on `T extends {entity_name}`
        // (the spread reassigns it). Top 5 across all sources.
        const ranked = rankCandidates(primaryName, allCandidates, { limit: 5 })
        if (ranked.length === 0) return

        await persistEvidence({
          jobId,
          contractorId: contractorRow?.id ?? null,
          evidence: {
            source_key: ranked[0].source_key,
            finding_type: 'entity_disambiguation_candidates',
            confidence: 'verified_structured',
            finding_summary:
              `Found ${ranked.length} entity candidate(s) similar to "${primaryName}" — exact-name lookup missed but related registered entities exist`,
            extracted_facts: {
              candidates: ranked,
              query: primaryName,
            },
            query_sent: null,
            response_sha256: null,
            response_snippet: null,
            duration_ms: 0,
            cost_cents: 0,
          },
          supabase: admin as unknown as SupabaseClient,
        })
      } catch (err) {
        console.warn('[orchestrator-v2] disambiguation fallback failed (non-fatal)', err)
      }
    })
  }

  // 230: dual-engine open-web phase. Patent claim 6.
  // Sweep with Perplexity → fan-out top adverse hits to Claude verify →
  // cross-engine corroboration detection. Opportunistic — non-fatal.
  // Skipped when entity_id_from_click is set (click-through path: user
  // already picked, no need to re-investigate).
  const openWebCfg = OPEN_WEB_CONFIG[opts.tier]
  if (openWebCfg.sweep_enabled && !input.entity_id_from_click) {
    await wrap('orch-open-web', async () => {
      try {
        const sweepEvidence = await scrapePerplexitySweep({
          legalName: primaryName,
          city: input.city ?? null,
          stateCode: input.state_code,
          lookbackMonths: openWebCfg.sweep_lookback_months,
          model: openWebCfg.sweep_model,
        })
        // Persist all sweep rows (envelope + per-citation classified rows).
        const persistedSweep: Array<ScraperEvidence & { id?: string }> = []
        for (const ev of sweepEvidence) {
          const persisted = await persistEvidence({
            jobId, contractorId: contractorRow?.id ?? null,
            evidence: ev, supabase: admin as unknown as SupabaseClient,
          })
          persistedSweep.push({ ...ev, id: persisted.evidenceId })
        }

        // Verify fan-out — top N adverse hits get a Claude web_search verify.
        // Free tier: verify_fanout_limit=0 so this is a no-op.
        const adverseHits = persistedSweep
          .filter((e) => e.finding_type === 'open_web_adverse_signal')
          .slice(0, openWebCfg.verify_fanout_limit)

        const persistedVerifications: Array<ScraperEvidence & { id?: string }> = []
        if (adverseHits.length > 0) {
          const verifyResults = await Promise.allSettled(
            adverseHits.map((hit) => {
              const facts = (hit.extracted_facts ?? {}) as Record<string, unknown>
              const url = typeof facts.citation_url === 'string' ? facts.citation_url : null
              if (!url) return Promise.resolve(null)
              return scrapeClaudeWebSearchVerify({
                claim: hit.finding_summary,
                citationUrl: url,
                contractorName: input.contractor_name,
              })
            }),
          )
          for (const r of verifyResults) {
            if (r.status !== 'fulfilled' || !r.value) continue
            const persisted = await persistEvidence({
              jobId, contractorId: contractorRow?.id ?? null,
              evidence: r.value, supabase: admin as unknown as SupabaseClient,
            })
            persistedVerifications.push({ ...r.value, id: persisted.evidenceId })
          }
        }

        // Cross-engine corroboration. Emit one event row per
        // Perplexity+Claude pair that agrees on URL or summary.
        const corroborations = detectCrossEngineCorroboration({
          perplexityEvidence: persistedSweep,
          claudeVerifications: persistedVerifications,
        })
        for (const ev of corroborations) {
          await persistEvidence({
            jobId, contractorId: contractorRow?.id ?? null,
            evidence: ev, supabase: admin as unknown as SupabaseClient,
          })
        }
      } catch (err) {
        console.warn('[orchestrator-v2] open-web phase failed (non-fatal)', err)
      }
    })
  }

  // 231: phoenix-LLC + cross-entity fraud-network detection (patent claim 1).
  // Runs when we have a canonical SOS hit (CO or TX). Queries the same
  // dataset for related entities sharing principal_address / agent / officer.
  // Opportunistic — never blocks the main flow.
  await wrap('orch-phoenix', async () => {
    try {
      const { data: sosRow } = await admin
        .from('trust_evidence')
        .select('source_key, finding_type, extracted_facts')
        .eq('job_id', jobId)
        .in('source_key', ['co_sos_biz', 'tx_sos_biz'])
        .in('finding_type', ['business_active', 'business_inactive', 'business_dissolved'])
        .order('sequence_number', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!sosRow) return
      const facts = (sosRow.extracted_facts ?? {}) as Record<string, unknown>
      const officers = Array.isArray(facts.officers) ? facts.officers as Array<Record<string, unknown>> : []
      const agentObj = officers.find((o) => o?.role_hint === 'registered_agent')
      const agentName = agentObj && typeof (agentObj as { name?: unknown }).name === 'string'
        ? (agentObj as { name: string }).name
        : (typeof facts.registered_agent_organization === 'string' ? facts.registered_agent_organization : null)
      const canonical: CanonicalEntity = {
        source_key: sosRow.source_key as 'co_sos_biz' | 'tx_sos_biz',
        entity_id: typeof facts.entity_id === 'string' ? facts.entity_id : '',
        entity_name: typeof facts.entity_name === 'string' ? facts.entity_name : input.contractor_name,
        principal_address: typeof facts.principal_address === 'string' ? facts.principal_address : null,
        registered_agent_name: agentName,
        formation_date: typeof facts.formation_date === 'string' ? facts.formation_date : null,
      }
      if (!canonical.entity_id) return
      const related = await detectPhoenixPattern(canonical)
      if (related.length === 0) return
      const phoenixEvidence = relatedEntitiesToEvidence(related, canonical)
      for (const ev of phoenixEvidence) {
        await persistEvidence({
          jobId, contractorId: contractorRow?.id ?? null,
          evidence: ev, supabase: admin as unknown as SupabaseClient,
        })
      }
    } catch (err) {
      console.warn('[orchestrator-v2] phoenix detection failed (non-fatal)', err)
    }
  })

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
  // Pull richer columns so buildEvidenceDerivedReport can populate
  // evidence_ids and raw_report.sources_cited (needs id, chain_hash,
  // pulled_at — see BuildReportEvidence interface).
  const { data: evidenceRows, error: evidenceErr } = await admin
    .from('trust_evidence')
    .select('id, source_key, finding_type, confidence, finding_summary, extracted_facts, chain_hash, pulled_at, sequence_number')
    .eq('job_id', jobId)
    .order('sequence_number', { ascending: true })

  if (evidenceErr) throw new Error(`finalizeFreeTier: read evidence: ${evidenceErr.message}`)

  const evidence = (evidenceRows ?? []).map((r) => ({
    id: r.id as string,
    source_key: r.source_key as string,
    finding_type: r.finding_type as ScraperEvidence['finding_type'],
    confidence: r.confidence as ScraperEvidence['confidence'],
    finding_summary: r.finding_summary as string,
    extracted_facts: (r.extracted_facts as Record<string, unknown>) ?? {},
    chain_hash: (r.chain_hash as string | null) ?? null,
    pulled_at: (r.pulled_at as string | null) ?? null,
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
      evidence_ids: derived.evidence_ids,
      raw_report: derived.raw_report,
      searched_as: input.searched_as ?? null,
      open_web_adverse_count: derived.open_web_adverse_count,
      open_web_positive_count: derived.open_web_positive_count,
      open_web_corroboration_depth: derived.open_web_corroboration_depth,
      open_web_recency_min: derived.open_web_recency_min,
      open_web_engines_used: derived.open_web_engines_used,
      related_entities: derived.related_entities.length > 0 ? derived.related_entities : null,
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
