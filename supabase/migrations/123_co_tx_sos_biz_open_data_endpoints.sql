-- Migration 123: re-point co_sos_biz and tx_sos_biz to Socrata SODA endpoints
-- Tier 3 #1 commit 4 prep — eliminates html_scrape + paid-account paths
--
-- CO open data exposes registered agent (no full member/manager list, but
-- enough to seed the officer graph for natural-person agents — service
-- companies are filtered out at scrape time).
-- TX Active Franchise Tax Permit Holders is presence-only (existence check
-- + status), zero officer data — scraper emits empty officers[].

UPDATE trust_source_registry
SET access_method = 'rest_api',
    base_url = 'https://data.colorado.gov/resource/4ykn-tg5h.json',
    query_template = '?$where=upper(entityname)%20like%20upper(%27%25{contractor_name}%25%27)&$limit=10',
    auth_type = 'none',
    notes = 'CO Socrata SODA. Fields: entityid, entityname, entitystatus (Good Standing/Delinquent/Voluntarily Dissolved/Dissolved/Forfeited), entitytype (DLLC/DCORP/etc), entityformdate (MM/DD/YYYY), agentfirstname/agentlastname (natural person registered agent), agentorganizationname (service-company agent — NOT emitted into officer graph). Registered agent emission gated on natural-person heuristic.',
    confidence_weight = 0.90,
    updated_at = NOW()
WHERE source_key = 'co_sos_biz';

UPDATE trust_source_registry
SET access_method = 'rest_api',
    base_url = 'https://data.texas.gov/resource/9cir-efmm.json',
    query_template = '?$where=upper(taxpayer_name)%20like%20upper(%27%25{contractor_name}%25%27)&$limit=10',
    auth_type = 'none',
    notes = 'TX Socrata SODA — Active Franchise Tax Permit Holders only. Presence = active (right_to_transact_business_code=A and sos_status_code=A); absence = forfeited/inactive/unregistered (ambiguous null result). Fields: taxpayer_number, taxpayer_name, taxpayer_organizational_type, sos_status_code, right_to_transact_business_code, responsibility_beginning_date (MM/DD/YYYY), secretary_of_state_sos_or_coa_file_number, sos_charter_date. NO officer/manager/member data — emit empty officers[].',
    confidence_weight = 0.85,
    updated_at = NOW()
WHERE source_key = 'tx_sos_biz';
