-- 226: synthesis diagnostics columns on trust_jobs.
--
-- Surfaces three new columns that runTrustSynthesizeV2 (PR #26) writes
-- across the LLM cascade so post-mortem analysis of stalled / slow
-- synthesis is no longer guesswork:
--
--   synthesis_started_at      — set at first leaf-step entry (just before
--                                the primary LLM attempt). NULL for jobs
--                                that took the free-tier templated path.
--   synthesis_completed_at    — set at orchestration exit, regardless of
--                                which layer (primary / sonnet / template)
--                                produced the synthesis. Difference vs
--                                synthesis_started_at is the cascade
--                                duration.
--   synthesis_attempt_count   — incremented per attempted layer. 1 = primary
--                                only, 2 = primary + sonnet, 3 = primary +
--                                sonnet + template, etc. Lets us aggregate
--                                fallback rates without grepping logs.
--
-- IF NOT EXISTS guard so the migration is safe to re-apply across rebases.
-- SMALLINT for attempt_count — synthesis cascades top out at 3 layers
-- today; SMALLINT covers up to 32k.

ALTER TABLE trust_jobs
  ADD COLUMN IF NOT EXISTS synthesis_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS synthesis_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS synthesis_attempt_count smallint DEFAULT 0;
