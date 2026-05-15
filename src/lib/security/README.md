# Security architecture

Defense in depth: edge → middleware → API+server-actions → Postgres.

Every public table has RLS. trust_report_audit + trust_score_history +
admin_actions are DB-level append-only (REVOKE UPDATE/DELETE + triggers).
5 bridge triggers pipe security events into intervention_cards — the same
spine /admin/command uses — so threats appear in the operator queue with
zero extra wiring. /admin/security is the deep view.

What this protects:
- Fraudulent contractor → trust_report_audit immutable, survives compromise
- Pricing scraper → canary listings, unique phones; if called, exfil confirmed
- AI poisoning → sanitizeEvidence + sentinel wrapper + score anomaly gate
- GPS-spoof tool → server-side velocity / accel / accuracy / teleport gates
- Stolen admin creds → admin_actions audit immutable; session pin available
- Brute force login → sliding-window rate limit + lockout + IP ban
- Honeypot scanner → auto-ban 7d; intervention card at 3+/hr
- Stolen service role key → DB-layer append-only on audit tables
- Mass review-bombing / score pumping → trust_reports velocity trigger
