#!/usr/bin/env bash
# Morning launch check — paste output to Claude.ai for verification.
set +e
cd "$(dirname "$0")/.."
echo "═══ MORNING LAUNCH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC') ═══"
echo
git fetch --all --quiet 2>/dev/null
echo "── REPO STATE ──"
echo "Local main:    $(git rev-parse main 2>/dev/null)"
echo "Origin main:   $(git rev-parse origin/main 2>/dev/null)"
[ "$(git rev-parse main 2>/dev/null)" = "$(git rev-parse origin/main 2>/dev/null)" ] && echo "Sync:          IN SYNC" || echo "Sync:          BEHIND — git pull --ff-only origin main"
echo
echo "── RECENT MAIN (last 8) ──"
git log --oneline origin/main 2>/dev/null | head -8
echo
echo "── OPEN PRS ──"
gh pr list --state open --json number,title,headRefName,mergeable --jq '.[] | "  PR #\(.number) [\(.mergeable)] \(.title) (\(.headRefName))"' 2>/dev/null
echo
for PR in 27 28 29; do
  if gh pr view $PR >/dev/null 2>&1; then
    echo "── PR #$PR ──"
    gh pr view $PR --json state,mergeable,mergeStateStatus,additions,deletions,statusCheckRollup --jq '"  state=\(.state) mergeable=\(.mergeable) merge=\(.mergeStateStatus) +\(.additions)/-\(.deletions)"' 2>/dev/null
    echo "  Commits:"
    gh pr view $PR --json commits --jq '.commits[] | "    \(.oid[:7]) \(.messageHeadline)"' 2>/dev/null | head -8
    PREVIEW=$(gh pr view $PR --json comments --jq '[.comments[].body | scan("https://[a-z0-9-]+(?:-aggregatemarket|project-fv1ww)[a-z0-9-]*\\.vercel\\.app")] | first // empty' 2>/dev/null)
    [ -n "$PREVIEW" ] && echo "  Preview: $PREVIEW"
    echo
  fi
done
echo "── OVERNIGHT BUILD STATUS LOG ──"
[ -f /tmp/path2-overnight-status.log ] && tail -30 /tmp/path2-overnight-status.log || echo "  (no log yet — build may still be running or hadn't started)"
echo
echo "── PASTE THIS BLOCK INTO CLAUDE.AI FOR MCP VERIFICATION ──"
cat << 'MCP_EOF'

Morning verification — please run via MCP and verdict:

WITH r AS (SELECT count(*) FROM trust_jobs WHERE status='synthesizing' AND COALESCE(synthesis_started_at,started_at,created_at) < now()-interval '5 minutes'),
     d AS (SELECT data_integrity_status, count(*) FROM trust_reports GROUP BY 1 ORDER BY 2 DESC),
     l AS (SELECT contractor_name, data_integrity_status, biz_status, raw_report->'business'->>'entity_name' AS canonical, raw_report->'business'->>'source_url' AS sos_url, array_length(evidence_ids,1) AS ev, created_at FROM trust_reports ORDER BY created_at DESC LIMIT 5),
     m AS (SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5),
     o AS (SELECT count(*) FROM osha_inspections WHERE inspection_date > now()-interval '1 year')
SELECT (SELECT count FROM r) AS stuck, (SELECT json_agg(row_to_json(d)) FROM d) AS dist, (SELECT json_agg(row_to_json(l)) FROM l) AS latest, (SELECT json_agg(version) FROM m) AS migs, (SELECT count FROM o) AS osha_recent;
MCP_EOF
echo
echo "── DECISION TREE ──"
echo "  • PR #27 preview clean? → gh pr merge 27 --squash --delete-branch"
echo "  • PR #28 preview clean? → gh pr merge 28 --squash --delete-branch"
echo "  • PR #29 (confirmation flow) needs review before merge"
echo "  • Migration drift cleanup → ls supabase/migrations/ | grep -E '^22[4-9]_' (rename or delete duplicates)"
echo "  • Anything red above? → paste this output to Claude.ai"
echo
echo "═══ END CHECK ═══"
