-- Upgrades trust_reports BEFORE trigger to:
-- 1. Always strip <cite index> tags from red_flags / positive_indicators / legal_findings / summary
--    (not just when filling from raw_report — handles synth code that copies cite tags into typed columns)
-- 2. Always normalize raw Sonar/Anthropic vocab (VERIFIED/UNKNOWN/CLEAR/SERIOUS/etc.) in typed status
--    columns to UI vocab (Active/Clear/Clean/etc.). Maps UNKNOWN → NULL.
-- Backfill fires trigger on every row to apply cleanup retroactively.

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
  -- (1) ALWAYS strip cite tags from existing typed-column text fields
  IF NEW.red_flags IS NOT NULL AND cardinality(NEW.red_flags) > 0 THEN
    SELECT array_agg(public.trust_strip_cite_tags(v))
      INTO NEW.red_flags
      FROM unnest(NEW.red_flags) AS v;
  END IF;
  IF NEW.positive_indicators IS NOT NULL AND cardinality(NEW.positive_indicators) > 0 THEN
    SELECT array_agg(public.trust_strip_cite_tags(v))
      INTO NEW.positive_indicators
      FROM unnest(NEW.positive_indicators) AS v;
  END IF;
  IF NEW.legal_findings IS NOT NULL AND cardinality(NEW.legal_findings) > 0 THEN
    SELECT array_agg(public.trust_strip_cite_tags(v))
      INTO NEW.legal_findings
      FROM unnest(NEW.legal_findings) AS v;
  END IF;
  NEW.summary := public.trust_strip_cite_tags(NEW.summary);

  -- (2) ALWAYS normalize raw vocab in typed status columns
  NEW.biz_status := CASE upper(NULLIF(NEW.biz_status,''))
    WHEN 'VERIFIED'  THEN 'Active'
    WHEN 'ACTIVE'    THEN 'Active'
    WHEN 'INACTIVE'  THEN 'Inactive'
    WHEN 'DISSOLVED' THEN 'Dissolved'
    WHEN 'NOT_FOUND' THEN 'Not Found'
    WHEN 'UNKNOWN'   THEN NULL
    ELSE NEW.biz_status
  END;
  NEW.lic_status := CASE upper(NULLIF(NEW.lic_status,''))
    WHEN 'ACTIVE'    THEN 'Active'
    WHEN 'INACTIVE'  THEN 'Inactive'
    WHEN 'EXPIRED'   THEN 'Expired'
    WHEN 'SUSPENDED' THEN 'Suspended'
    WHEN 'NOT_FOUND' THEN 'Not Found'
    WHEN 'UNKNOWN'   THEN NULL
    ELSE NEW.lic_status
  END;
  NEW.legal_status := CASE upper(NULLIF(NEW.legal_status,''))
    WHEN 'CLEAR'             THEN 'Clear'
    WHEN 'CLEAN'             THEN 'Clear'
    WHEN 'NO_ACTIONS'        THEN 'Clear'
    WHEN 'ACTIONS_FOUND'     THEN 'Actions Found'
    WHEN 'JUDGMENT_AGAINST'  THEN 'Judgment Against'
    WHEN 'UNKNOWN'           THEN NULL
    ELSE NEW.legal_status
  END;
  NEW.osha_status := CASE upper(NULLIF(NEW.osha_status,''))
    WHEN 'CLEAR'            THEN 'Clean'
    WHEN 'CLEAN'            THEN 'Clean'
    WHEN 'NO_VIOLATIONS'    THEN 'Clean'
    WHEN 'VIOLATIONS_FOUND' THEN 'Violations Found'
    WHEN 'SERIOUS'          THEN 'Serious Violations'
    WHEN 'UNKNOWN'          THEN NULL
    ELSE NEW.osha_status
  END;

  -- Skip raw_report projection if there's no raw_report
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
      SELECT array_agg(public.trust_strip_cite_tags(v))
        INTO NEW.legal_findings
        FROM jsonb_array_elements_text(legal->'findings') AS v;
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

  -- Red flags / positive indicators (only fill if currently empty; cite-strip already done above)
  IF (NEW.red_flags IS NULL OR cardinality(NEW.red_flags) = 0)
     AND jsonb_typeof(rr->'red_flags') = 'array' THEN
    SELECT array_agg(public.trust_strip_cite_tags(v))
      INTO NEW.red_flags
      FROM jsonb_array_elements_text(rr->'red_flags') AS v;
    IF NEW.red_flags IS NULL THEN NEW.red_flags := '{}'::text[]; END IF;
  END IF;
  IF (NEW.positive_indicators IS NULL OR cardinality(NEW.positive_indicators) = 0)
     AND jsonb_typeof(rr->'positive_indicators') = 'array' THEN
    SELECT array_agg(public.trust_strip_cite_tags(v))
      INTO NEW.positive_indicators
      FROM jsonb_array_elements_text(rr->'positive_indicators') AS v;
    IF NEW.positive_indicators IS NULL THEN NEW.positive_indicators := '{}'::text[]; END IF;
  END IF;

  -- Summary (cite-strip already applied at top); only fill if NULL
  NEW.summary := COALESCE(NEW.summary, public.trust_strip_cite_tags(NULLIF(rr->>'summary','')));

  -- Score / risk level
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

  IF NEW.confidence_level IS NULL THEN
    NEW.confidence_level := COALESCE(
      CASE upper(NULLIF(rr->>'confidence_level',''))
        WHEN 'HIGH'   THEN 'HIGH'
        WHEN 'MEDIUM' THEN 'MEDIUM'
        WHEN 'LOW'    THEN 'LOW'
        ELSE NULL
      END,
      'MEDIUM'
    );
  END IF;

  IF (NEW.data_sources_searched IS NULL OR cardinality(NEW.data_sources_searched) = 0)
     AND jsonb_typeof(rr->'data_sources_searched') = 'array' THEN
    SELECT array_agg(v)
      INTO NEW.data_sources_searched
      FROM jsonb_array_elements_text(rr->'data_sources_searched') AS v;
    IF NEW.data_sources_searched IS NULL THEN NEW.data_sources_searched := '{}'::text[]; END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: fire trigger on all rows (cleanup applies even when raw_report is NULL)
UPDATE public.trust_reports SET raw_report = raw_report;
