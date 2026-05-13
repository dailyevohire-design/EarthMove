-- 246_peer_network_detector_v1.sql
-- Activates the patent's peer-network claim across the entire contractor base.
-- Two signals, both purely SQL, both queryable end-to-end after this migration:
--
--   signal_type='name_similarity'   pg_trgm similarity >= 0.65 within same
--                                   state. Catches the Bedrock excavating /
--                                   Bedrock excavation phoenix pair without
--                                   needing officer data.
--   signal_type='shared_officer'    trust_officer_links graph join within
--                                   same state. Catches multi-LLC patterns
--                                   sharing the same natural-person principal
--                                   or registered agent.
--
-- Findings go into a dedicated table (trust_peer_network_findings) — not
-- trust_evidence — to avoid chain_hash discipline. Commit G (TS synth
-- integration) reads from this table to write proper evidence rows under
-- the canonical chain-hash pipeline.
--
-- Pair dedup: contractor_id < peer_contractor_id (one row per pair per signal).
-- Idempotent: ON CONFLICT DO UPDATE for re-application.

BEGIN;

-- ─── Preconditions ───────────────────────────────────────────────────────────
DO $pre$
DECLARE
  has_pg_trgm bool;
  has_officer_links bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') INTO has_pg_trgm;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='trust_officer_links') INTO has_officer_links;
  IF NOT has_pg_trgm THEN
    RAISE EXCEPTION 'mig246 precondition: pg_trgm extension required';
  END IF;
  IF NOT has_officer_links THEN
    RAISE EXCEPTION 'mig246 precondition: trust_officer_links table required';
  END IF;
  RAISE NOTICE 'mig246 preconditions ok: pg_trgm + officer_links present';
END $pre$;

-- ─── GIN trigram index for fast similarity scans ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contractors_normalized_name_trgm
  ON contractors USING gin (normalized_name gin_trgm_ops);

-- ─── Findings table ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS trust_peer_network_findings;
CREATE TABLE trust_peer_network_findings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id         uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  peer_contractor_id    uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  signal_type           text NOT NULL CHECK (signal_type IN (
    'name_similarity',
    'shared_officer'
  )),
  signal_value          text,
  signal_strength       numeric NOT NULL CHECK (signal_strength BETWEEN 0 AND 1),
  state_code            text NOT NULL,
  detector_version      text NOT NULL DEFAULT 'v246',
  detected_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (contractor_id <> peer_contractor_id),
  CHECK (contractor_id < peer_contractor_id),  -- canonical pair ordering
  UNIQUE (contractor_id, peer_contractor_id, signal_type)
);

CREATE INDEX idx_tpnf_contractor       ON trust_peer_network_findings (contractor_id, signal_strength DESC);
CREATE INDEX idx_tpnf_peer             ON trust_peer_network_findings (peer_contractor_id, signal_strength DESC);
CREATE INDEX idx_tpnf_state_strength   ON trust_peer_network_findings (state_code, signal_type, signal_strength DESC);

COMMENT ON TABLE trust_peer_network_findings IS
  'Patent-defining peer-network signals. Populated by mig 246 and refreshable via refresh_peer_network_findings(). Consumed by synth pipeline (commit G) to write proper trust_evidence rows under the canonical chain-hash discipline.';

-- ─── Set similarity threshold for the % operator (session-local) ─────────────
SELECT set_limit(0.65);

-- ─── Populate: name-similarity signal ────────────────────────────────────────
WITH name_pairs AS (
  SELECT
    c1.id AS contractor_id,
    c2.id AS peer_contractor_id,
    similarity(c1.normalized_name, c2.normalized_name) AS sim,
    c1.state_code::text AS state_code,
    c1.normalized_name AS n1,
    c2.normalized_name AS n2
  FROM contractors c1
  JOIN contractors c2
    ON c1.state_code = c2.state_code
   AND c1.id < c2.id
   AND c1.normalized_name % c2.normalized_name
  WHERE c1.normalized_name IS NOT NULL
    AND c2.normalized_name IS NOT NULL
    AND length(c1.normalized_name) >= 3
    AND length(c2.normalized_name) >= 3
    AND c1.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
    AND c2.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
)
INSERT INTO trust_peer_network_findings (
  contractor_id, peer_contractor_id, signal_type, signal_value, signal_strength, state_code
)
SELECT
  contractor_id,
  peer_contractor_id,
  'name_similarity',
  '"' || n1 || '" <-> "' || n2 || '" (sim=' || round(sim::numeric, 3)::text || ')',
  round(sim::numeric, 4),
  state_code
FROM name_pairs
WHERE sim >= 0.65
ON CONFLICT (contractor_id, peer_contractor_id, signal_type) DO UPDATE
  SET signal_value    = EXCLUDED.signal_value,
      signal_strength = EXCLUDED.signal_strength,
      detected_at     = now();

-- ─── Populate: shared-officer signal ─────────────────────────────────────────
WITH officer_pairs AS (
  SELECT
    ol1.contractor_id AS contractor_id,
    ol2.contractor_id AS peer_contractor_id,
    o.officer_name,
    o.officer_name_normalized,
    o.is_likely_natural_person,
    ol1.role AS role_c1,
    ol2.role AS role_c2,
    c1.state_code::text AS state_code,
    c1.legal_name AS c1_name,
    c2.legal_name AS c2_name
  FROM trust_officer_links ol1
  JOIN trust_officer_links ol2
    ON ol1.officer_id = ol2.officer_id
   AND ol1.contractor_id < ol2.contractor_id
  JOIN trust_officers o ON o.id = ol1.officer_id
  JOIN contractors c1 ON c1.id = ol1.contractor_id
  JOIN contractors c2 ON c2.id = ol2.contractor_id
  WHERE c1.state_code = c2.state_code
    AND c1.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
    AND c2.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
    AND length(coalesce(o.officer_name_normalized,'')) >= 3
)
INSERT INTO trust_peer_network_findings (
  contractor_id, peer_contractor_id, signal_type, signal_value, signal_strength, state_code
)
SELECT
  contractor_id,
  peer_contractor_id,
  'shared_officer',
  officer_name || ' (' ||
    (CASE WHEN is_likely_natural_person THEN 'natural-person principal' ELSE 'entity / agent' END) ||
    ', roles: ' || role_c1 || ' + ' || role_c2 || ')',
  CASE
    WHEN is_likely_natural_person THEN 0.95
    ELSE 0.80
  END::numeric,
  state_code
FROM officer_pairs
ON CONFLICT (contractor_id, peer_contractor_id, signal_type) DO UPDATE
  SET signal_value    = EXCLUDED.signal_value,
      signal_strength = EXCLUDED.signal_strength,
      detected_at     = now();

-- ─── Helper RPC: get all peers for a contractor (canonical-order aware) ──────
CREATE OR REPLACE FUNCTION get_peers_for_contractor(p_contractor_id uuid)
RETURNS TABLE (
  peer_contractor_id  uuid,
  peer_legal_name     text,
  peer_normalized     text,
  peer_state_code     text,
  signal_type         text,
  signal_value        text,
  signal_strength     numeric,
  detected_at         timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog','public'
AS $func$
  SELECT
    CASE WHEN f.contractor_id = p_contractor_id THEN f.peer_contractor_id
         ELSE f.contractor_id END AS peer_contractor_id,
    c.legal_name AS peer_legal_name,
    c.normalized_name AS peer_normalized,
    c.state_code::text AS peer_state_code,
    f.signal_type,
    f.signal_value,
    f.signal_strength,
    f.detected_at
  FROM trust_peer_network_findings f
  JOIN contractors c
    ON c.id = CASE WHEN f.contractor_id = p_contractor_id THEN f.peer_contractor_id
                   ELSE f.contractor_id END
  WHERE f.contractor_id = p_contractor_id OR f.peer_contractor_id = p_contractor_id
  ORDER BY f.signal_strength DESC, f.signal_type;
$func$;

GRANT EXECUTE ON FUNCTION get_peers_for_contractor(uuid) TO authenticated, anon, service_role;

-- ─── Helper RPC: refresh entire findings table on demand ─────────────────────
CREATE OR REPLACE FUNCTION refresh_peer_network_findings()
RETURNS TABLE (signal_type text, rows_upserted bigint)
LANGUAGE plpgsql
AS $func$
DECLARE
  name_rows bigint;
  officer_rows bigint;
BEGIN
  PERFORM set_limit(0.65);

  WITH name_pairs AS (
    SELECT c1.id AS contractor_id, c2.id AS peer_contractor_id,
           similarity(c1.normalized_name, c2.normalized_name) AS sim,
           c1.state_code::text AS state_code,
           c1.normalized_name AS n1, c2.normalized_name AS n2
    FROM contractors c1
    JOIN contractors c2
      ON c1.state_code = c2.state_code
     AND c1.id < c2.id
     AND c1.normalized_name % c2.normalized_name
    WHERE c1.normalized_name IS NOT NULL AND c2.normalized_name IS NOT NULL
      AND length(c1.normalized_name) >= 3 AND length(c2.normalized_name) >= 3
      AND c1.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
      AND c2.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
  ),
  upserted_names AS (
    INSERT INTO trust_peer_network_findings (
      contractor_id, peer_contractor_id, signal_type, signal_value, signal_strength, state_code
    )
    SELECT contractor_id, peer_contractor_id, 'name_similarity',
           '"' || n1 || '" <-> "' || n2 || '" (sim=' || round(sim::numeric, 3)::text || ')',
           round(sim::numeric, 4), state_code
    FROM name_pairs WHERE sim >= 0.65
    ON CONFLICT (contractor_id, peer_contractor_id, signal_type) DO UPDATE
      SET signal_value=EXCLUDED.signal_value, signal_strength=EXCLUDED.signal_strength, detected_at=now()
    RETURNING 1
  )
  SELECT count(*) INTO name_rows FROM upserted_names;

  WITH officer_pairs AS (
    SELECT ol1.contractor_id AS contractor_id, ol2.contractor_id AS peer_contractor_id,
           o.officer_name, o.is_likely_natural_person,
           ol1.role AS role_c1, ol2.role AS role_c2,
           c1.state_code::text AS state_code
    FROM trust_officer_links ol1
    JOIN trust_officer_links ol2 ON ol1.officer_id=ol2.officer_id AND ol1.contractor_id < ol2.contractor_id
    JOIN trust_officers o ON o.id=ol1.officer_id
    JOIN contractors c1 ON c1.id=ol1.contractor_id
    JOIN contractors c2 ON c2.id=ol2.contractor_id
    WHERE c1.state_code = c2.state_code
      AND c1.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
      AND c2.legal_name !~* '^(FTEST_|FORENSIC_TEST_|TEST_|mock|test_)'
      AND length(coalesce(o.officer_name_normalized,'')) >= 3
  ),
  upserted_officers AS (
    INSERT INTO trust_peer_network_findings (
      contractor_id, peer_contractor_id, signal_type, signal_value, signal_strength, state_code
    )
    SELECT contractor_id, peer_contractor_id, 'shared_officer',
           officer_name || ' (' ||
             (CASE WHEN is_likely_natural_person THEN 'natural-person principal' ELSE 'entity / agent' END) ||
             ', roles: ' || role_c1 || ' + ' || role_c2 || ')',
           (CASE WHEN is_likely_natural_person THEN 0.95 ELSE 0.80 END)::numeric,
           state_code
    FROM officer_pairs
    ON CONFLICT (contractor_id, peer_contractor_id, signal_type) DO UPDATE
      SET signal_value=EXCLUDED.signal_value, signal_strength=EXCLUDED.signal_strength, detected_at=now()
    RETURNING 1
  )
  SELECT count(*) INTO officer_rows FROM upserted_officers;

  RETURN QUERY SELECT 'name_similarity'::text, name_rows
               UNION ALL
               SELECT 'shared_officer'::text, officer_rows;
END
$func$;

GRANT EXECUTE ON FUNCTION refresh_peer_network_findings() TO service_role;

-- ─── Postcondition: report findings + canary on Bedrock pair ─────────────────
DO $post$
DECLARE
  name_count int;
  officer_count int;
  bedrock_pair_found bool;
  total_findings int;
BEGIN
  SELECT count(*) INTO name_count
    FROM trust_peer_network_findings WHERE signal_type='name_similarity';
  SELECT count(*) INTO officer_count
    FROM trust_peer_network_findings WHERE signal_type='shared_officer';
  SELECT count(*) INTO total_findings FROM trust_peer_network_findings;

  SELECT EXISTS(
    SELECT 1 FROM trust_peer_network_findings f
    JOIN contractors c1 ON c1.id = f.contractor_id
    JOIN contractors c2 ON c2.id = f.peer_contractor_id
    WHERE c1.normalized_name LIKE 'bedrock excavat%'
      AND c2.normalized_name LIKE 'bedrock excavat%'
      AND f.signal_type = 'name_similarity'
  ) INTO bedrock_pair_found;

  RAISE NOTICE 'mig246 populated: name_similarity=%, shared_officer=%, total=%',
    name_count, officer_count, total_findings;
  RAISE NOTICE 'mig246 canary: Bedrock excavating <-> Bedrock excavation pair found = %',
    bedrock_pair_found;

  IF total_findings = 0 THEN
    RAISE EXCEPTION 'mig246 postcondition: 0 findings produced — detector is mis-wired';
  END IF;
END $post$;

COMMIT;
