-- live_sessions BEFORE UPDATE trigger. APPLIED VIA MCP 2026-05-14. Doc-only.
-- Preserves first-touch UTM + referrer, clamps first_seen_at backward,
-- auto-increments page_view_count on real path changes.

CREATE OR REPLACE FUNCTION public.live_sessions_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.utm_source   := COALESCE(OLD.utm_source,   NEW.utm_source);
  NEW.utm_medium   := COALESCE(OLD.utm_medium,   NEW.utm_medium);
  NEW.utm_campaign := COALESCE(OLD.utm_campaign, NEW.utm_campaign);
  NEW.utm_term     := COALESCE(OLD.utm_term,     NEW.utm_term);
  NEW.utm_content  := COALESCE(OLD.utm_content,  NEW.utm_content);
  NEW.referrer     := COALESCE(OLD.referrer,     NEW.referrer);
  NEW.first_seen_at := LEAST(OLD.first_seen_at, NEW.first_seen_at);
  IF OLD.current_path IS DISTINCT FROM NEW.current_path
     AND NEW.current_path IS NOT NULL THEN
    NEW.page_view_count := COALESCE(OLD.page_view_count, 0) + 1;
  ELSE
    NEW.page_view_count := OLD.page_view_count;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS live_sessions_before_update ON public.live_sessions;
CREATE TRIGGER live_sessions_before_update
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.live_sessions_before_update();
