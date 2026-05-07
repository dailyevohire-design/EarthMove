-- 225: pg_cron sweeper for stalled synthesis jobs.
--
-- Third layer of the watchdog defense (after the in-Inngest watchdog and
-- the runTrustSynthesizeV2.onFailure handler from PR #26). This is the
-- "everything else fell through" backstop: if a job sits in 'synthesizing'
-- for more than 4 minutes, force-fail it so users see an error and the
-- credit-reversal flow can run.
--
-- Cadence: every minute. The synthesis cascade typically completes in
-- 30-90s, so 4 minutes is comfortably past the natural ceiling.
--
-- Idempotency: SELECT cron.schedule(...) on an existing job_name updates
-- the schedule in place (pg_cron 1.4+). Safe to re-apply.
--
-- The error_message append uses COALESCE(error_message, '') to handle
-- both the column-NULL initial state and the additive-append case where
-- onFailure already wrote a message.

CREATE OR REPLACE FUNCTION sweep_stalled_synthesis() RETURNS void AS $$
BEGIN
  UPDATE trust_jobs
  SET status = 'failed',
      completed_at = now(),
      error_message = COALESCE(error_message, '')
        || E'\n[sweeper ' || now()::text || '] force-failed: synthesizing > 4min'
  WHERE status = 'synthesizing'
    AND started_at < now() - interval '4 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule every minute. cron.schedule returns the job_id; we don't capture
-- it because the function name ('sweep-stalled-synthesis') is the durable
-- identifier for re-runs.
SELECT cron.schedule(
  'sweep-stalled-synthesis',
  '* * * * *',
  $cmd$SELECT sweep_stalled_synthesis();$cmd$
);
