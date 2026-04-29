-- Projects trust_reports.raw_report jsonb into typed columns via BEFORE trigger.
-- Fixes 167/179 reports rendering empty UI boxes despite having full Anthropic
-- synthesis output. Strips Sonar <cite index> tags inline. Idempotent: existing
-- non-null typed columns are preserved (COALESCE pattern).

BEGIN;

-- 1. Cite-tag stripper (mirrors src/lib/trust/sonar.ts stripCiteTags)
CREATE OR REPLACE FUNCTION public.trust_strip_cite_tags(input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE regexp_replace(
           regexp_replace(input, '<cite\s+index="[^"]*">([\s\S]*?)</cite>', '\1', 'gi'),
           '</?cite[^>]*>', '', 'gi'
         )
  END;
$$;

-- 2. Trigger function: project raw_report JSON into typed columns
CREATE OR REPLACE FUNCTION public.trust_project_raw_report_to_columns_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  rr    jsonb := NEW.raw_report;
  br    jsonb;
  lic   jsonb;
  bbb   jsonb;
  rev   jsonb;
  legal jsonb;
  osha  jsonb;
BEGIN
  IF rr IS NULL OR rr = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  br    := rr->'business_registration';
  lic   := rr->'licensing';
  bbb   := rr->'bbb_profile';
  rev   := rr->'reviews';
  legal := rr->'legal_records';
  osha  := rr->'osha_violations';

  -- Business
  IF br IS NOT NULL AND br <> 'null'::jsonb THEN
    NEW.biz_status := COALESCE(NEW.biz_status,
      CASE upper(NULLIF(br->>'status',''))
        WHEN 'VERIFIED'  THEN 'Active'
        WHEN 'ACTIVE'    THEN 'Active'
        WHEN 'INACTIVE'  THEN 'Inactive'
        WHEN 'DISSOLVED' THEN 'Dissolved'
        WHEN 'NOT_FOUND' THEN 'Not Found'
        ELSE NULL
      END);
    NEW.biz_entity_type    := COALESCE(NEW.biz_entity_type,    NULLIF(br->>'entity_type',''));
    NEW.biz_formation_date := COALESCE(NEW.biz_formation_date, NULLIF(br->>'formation_date',''));
  END IF;

  -- Licensing
  IF lic IS NOT NULL AND lic <> 'null'::jsonb THEN
    NEW.lic_status := COALESCE(NEW.lic_status,
      CASE upper(NULLIF(lic->>'status',''))
        WHEN 'ACTIVE'    THEN 'Active'
        WHEN 'INACTIVE'  THEN 'Inactive'
        WHEN 'EXPIRED'   THEN 'Expired'
        WHEN 'SUSPENDED' THEN 'Suspended'
        WHEN 'NOT_FOUND' THEN 'Not Found'
        ELSE NULL
      END);
    NEW.lic_license_number := COALESCE(NEW.lic_license_number, NULLIF(lic->>'license_number',''));
  END IF;

  -- BBB
  IF bbb IS NOT NULL AND bbb <> 'null'::jsonb THEN
    NEW.bbb_rating          := COALESCE(NEW.bbb_rating,          NULLIF(bbb->>'rating',''));
    NEW.bbb_accredited      := COALESCE(NEW.bbb_accredited,      (bbb->>'accredited')::boolean);
    NEW.bbb_complaint_count := COALESCE(NEW.bbb_complaint_count, (bbb->>'complaint_count')::smallint);
  END IF;

  -- Reviews
  IF rev IS NOT NULL AND rev <> 'null'::jsonb THEN
    NEW.review_avg_rating := COALESCE(NEW.review_avg_rating, (rev->>'average_rating')::numeric);
    NEW.review_total      := COALESCE(NEW.review_total,      (rev->>'total_reviews')::integer);
    NEW.review_sentiment  := COALESCE(NEW.review_sentiment,  NULLIF(rev->>'sentiment',''));
  END IF;

  -- Legal
  IF legal IS NOT NULL AND legal <> 'null'::jsonb THEN
    NEW.legal_status := COALESCE(NEW.legal_status,
      CASE upper(NULLIF(legal->>'status',''))
        WHEN 'CLEAR'             THEN 'Clear'
        WHEN 'CLEAN'             THEN 'Clear'
        WHEN 'NO_ACTIONS'        THEN 'Clear'
        WHEN 'ACTIONS_FOUND'     THEN 'Actions Found'
        WHEN 'JUDGMENT_AGAINST'  THEN 'Judgment Against'
        ELSE NULL
      END);
    IF (NEW.legal_findings IS NULL OR cardinality(NEW.legal_findings) = 0)
       AND jsonb_typeof(legal->'findings') = 'array' THEN
      SELECT array_agg(public.trust_strip_cite_tags(value))
        INTO NEW.legal_findings
        FROM jsonb_array_elements_text(legal->'findings');
      IF NEW.legal_findings IS NULL THEN NEW.legal_findings := '{}'::text[]; END IF;
    END IF;
  END IF;

  -- OSHA
  IF osha IS NOT NULL AND osha <> 'null'::jsonb THEN
    NEW.osha_status := COALESCE(NEW.osha_status,
      CASE upper(NULLIF(osha->>'status',''))
        WHEN 'CLEAR'            THEN 'Clean'
        WHEN 'CLEAN'            THEN 'Clean'
        WHEN 'NO_VIOLATIONS'    THEN 'Clean'
        WHEN 'VIOLATIONS_FOUND' THEN 'Violations Found'
        WHEN 'SERIOUS'          THEN 'Serious Violations'
        ELSE NULL
      END);
    NEW.osha_violation_count := COALESCE(NEW.osha_violation_count, (osha->>'violation_count')::smallint);
    NEW.osha_serious_count   := COALESCE(NEW.osha_serious_count,   (osha->>'serious_count')::smallint);
  END IF;

  -- Red flags / positive indicators (with cite-tag strip on legacy data)
  IF (NEW.red_flags IS NULL OR cardinality(NEW.red_flags) = 0)
     AND jsonb_typeof(rr->'red_flags') = 'array' THEN
    SELECT array_agg(public.trust_strip_cite_tags(value))
      INTO NEW.red_flags
      FROM jsonb_array_elements_text(rr->'red_flags');
    IF NEW.red_flags IS NULL THEN NEW.red_flags := '{}'::text[]; END IF;
  END IF;
  IF (NEW.positive_indicators IS NULL OR cardinality(NEW.positive_indicators) = 0)
     AND jsonb_typeof(rr->'positive_indicators') = 'array' THEN
    SELECT array_agg(public.trust_strip_cite_tags(value))
      INTO NEW.positive_indicators
      FROM jsonb_array_elements_text(rr->'positive_indicators');
    IF NEW.positive_indicators IS NULL THEN NEW.positive_indicators := '{}'::text[]; END IF;
  END IF;

  -- Summary (with cite strip)
  NEW.summary := COALESCE(NEW.summary, public.trust_strip_cite_tags(NULLIF(rr->>'summary','')));

  -- Score / risk level (respects upper-case CHECK constraint)
  NEW.trust_score := COALESCE(NEW.trust_score, (rr->>'trust_score')::smallint);
  NEW.risk_level  := COALESCE(NEW.risk_level,
    CASE upper(NULLIF(rr->>'risk_level',''))
      WHEN 'LOW'       THEN 'LOW'
      WHEN 'MEDIUM'    THEN 'MEDIUM'
      WHEN 'HIGH'      THEN 'HIGH'
      WHEN 'CRITICAL'  THEN 'CRITICAL'
      WHEN 'AMBIGUOUS' THEN 'AMBIGUOUS'
      ELSE NULL
    END);

  -- Confidence level (NOT NULL constraint — only project if raw_report has a valid value)
  IF NEW.confidence_level IS NULL THEN
    NEW.confidence_level := COALESCE(
      CASE upper(NULLIF(rr->>'confidence_level',''))
        WHEN 'HIGH'   THEN 'HIGH'
        WHEN 'MEDIUM' THEN 'MEDIUM'
        WHEN 'LOW'    THEN 'LOW'
        ELSE NULL
      END,
      'MEDIUM'  -- safe default; constraint requires non-null
    );
  END IF;

  -- Data sources
  IF (NEW.data_sources_searched IS NULL OR cardinality(NEW.data_sources_searched) = 0)
     AND jsonb_typeof(rr->'data_sources_searched') = 'array' THEN
    SELECT array_agg(value)
      INTO NEW.data_sources_searched
      FROM jsonb_array_elements_text(rr->'data_sources_searched');
    IF NEW.data_sources_searched IS NULL THEN NEW.data_sources_searched := '{}'::text[]; END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Wire trigger (BEFORE so we can mutate NEW)
DROP TRIGGER IF EXISTS trust_reports_project_raw_report ON public.trust_reports;
CREATE TRIGGER trust_reports_project_raw_report
  BEFORE INSERT OR UPDATE OF raw_report ON public.trust_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trust_project_raw_report_to_columns_trigger();

-- 4. Backfill: no-op write to raw_report fires UPDATE OF trigger
UPDATE public.trust_reports
   SET raw_report = raw_report
 WHERE raw_report IS NOT NULL
   AND raw_report <> '{}'::jsonb;

COMMIT;
