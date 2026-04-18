#!/usr/bin/env bash
# ============================================================
# EARTHMOVE.IO — DASHBOARD + CONTRACTOR TRUST ENGINE (NEUTRALIZED)
# ============================================================
#
# 2026-04-17 — Heredocs removed. This installer is no longer the
# source of truth for anything in the codebase.
#
# WHY IT'S NEUTRALIZED
# --------------------
# This script originally bootstrapped the dashboard + trust engine by
# materializing ~13 files via inline heredocs. After Agents 1 and 2
# landed the tier-aware trust engine, Zod schema expansion, homeowner
# prompts, resolver, entitlement check, and the Supabase migrations
# (020 + 021), those heredocs encoded an OBSOLETE version of every
# file they generated. Re-running this script would silently clobber:
#
#   - src/lib/trust/trust-engine.ts        (would revert tier dispatch)
#   - src/lib/trust/trust-validator.ts     (would revert Zod enum to 3 values)
#   - src/lib/trust/rate-limiter.ts        (would drop homeowner + resolver limiters)
#   - src/app/api/trust/route.ts           (would drop entitlement 402 check)
#   - src/lib/trust/prompt-guards.ts
#   - sql/dashboard_trust_migration.sql
#   - src/app/dashboard/layout.tsx
#   - src/app/dashboard/page.tsx
#   - src/app/dashboard/gc/page.tsx
#   - src/app/dashboard/gc/contractors/page.tsx
#   - src/app/dashboard/gc/contractors/ContractorCheckClient.tsx
#   - src/app/dashboard/driver/page.tsx
#
# SOURCE OF TRUTH
# ---------------
# Live files under src/lib/trust/ and src/app/ are canonical.
# Database schema: supabase/migrations/*.sql (apply via Supabase MCP
# or `supabase db push`). Full spec: docs/MASTER_BLUEPRINT.md.
#
# IF YOU NEED TO RE-BOOTSTRAP
# ---------------------------
# Start from the live tree. Don't re-run this.
# Prior behavior preserved in git history at commit f99966f
# (`fix: trust engine - install SDK, fix model string to claude-sonnet-4-6`).

set -euo pipefail

cat <<'BANNER' >&2
[!]  install_dashboard.sh is neutralized as of 2026-04-17.
     The heredocs it previously expanded are now OBSOLETE and would
     clobber Agent 1 + Agent 2 work if executed.
     Source of truth: src/lib/trust/, src/app/api/trust/, supabase/migrations/.
     See docs/MASTER_BLUEPRINT.md for the full spec.
     Recover the old script from git if you truly need it:
       git show f99966f:install_dashboard.sh > /tmp/old_installer.sh
BANNER

exit 2
