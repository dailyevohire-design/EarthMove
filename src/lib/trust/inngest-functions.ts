import { inngest } from '@/lib/inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { persistEvidence } from './scrapers/persist-evidence'
import { runScraper, sourcesForTier } from './scrapers/registry'

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
            failure_reason: String(error?.message ?? error).slice(0, 500),
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
        .select('id, tier, contractor_name, state_code, city, contractor_id')
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

    // 3. Determine sources for this tier
    const sources = sourcesForTier(job.tier)

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
          const evidence = await runScraper(sourceKey, {
            legalName: job.contractor_name,
            stateCode: job.state_code,
            city: job.city,
          })
          const persisted = await persistEvidence({
            jobId: job_id,
            contractorId: contractorRow?.id ?? null,
            evidence,
            supabase: admin as any,
          })
          return { ok: true, evidenceId: persisted.evidenceId, sourceKey }
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
          return { ok: false, sourceKey, error: String(err?.message ?? err) }
        }
      })
      if (result.ok) completed += 1
      else failed += 1
    }

    // 6. Update counters + flip to 'synthesizing'.
    //    runTrustJobV2 ENDS HERE. Synthesis (Sonar+Anthropic call →
    //    score_and_finalize_trust_report → trust_project_evidence_to_report)
    //    will be a separate runTrustSynthesizeV2 function in a later commit,
    //    triggered on event 'trust/job.synthesize.requested'.
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

    return { job_id, sources_attempted: sources.length, completed, failed }
  },
)
