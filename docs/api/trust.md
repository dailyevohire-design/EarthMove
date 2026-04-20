# POST /api/trust — Ground Check contractor verification

Returns a structured trust report for a named contractor. Runs web searches via Anthropic's `web_search` tool, applies class detection (ROOFER / MULTI_STATE_STORM_CORRIDOR / POST_DISASTER_ENTRANT), enforces tier-based rate limits and daily cost caps, and caches non-enterprise results.

---

## Endpoint

```
POST /api/trust
Content-Type: application/json
```

Production base URL: `https://earthmove.io`.

---

## Request body

### Required

| Field | Type | Constraints |
|---|---|---|
| `contractor_name` | string | 1–200 chars after sanitization. Injection-scanned. |
| `city` | string | 1–100 chars after sanitization. Injection-scanned. |
| `state_code` | string | Exactly 2 uppercase letters matching `^[A-Z]{2}$`. |

### Optional

| Field | Type | Default | Constraints |
|---|---|---|---|
| `tier` | `"free" \| "pro" \| "enterprise"` | `"free"` | `pro` and `enterprise` require an authenticated user. |
| `address` | string | — | 1–200 chars after sanitization. Injection-scanned. Use to disambiguate when a plain-name query returns `AMBIGUOUS`. |
| `principal` | string | — | 1–150 chars after sanitization. Injection-scanned. Owner / officer name. |
| `license_number` | string | — | 1–50 chars after sanitization. Structurally constrained, no injection scan. |
| `ein_last4` | string | — | Exactly 4 digits matching `^\d{4}$`. |

Empty or whitespace-only optional fields are ignored.

---

## Response shape

Successful responses are `HTTP 200` with the following flat JSON (selected fields):

```
risk_level:            "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "AMBIGUOUS" | null
trust_score:           0–100 integer | null
confidence_level:      "HIGH" | "MEDIUM" | "LOW"
summary:               string (opens with a Step-6 template sentence)
red_flags[]:           string
positive_indicators[]: string
business_registration: { status, entity_type, formation_date, registered_agent, source }
licensing:             { status, license_number, expiration, source }
bbb_profile:           { rating ("A+"|"A"|"B"|"C"|"D"|"F"|"NR"|null), accredited, complaint_count, years_in_business, source }
reviews:               { average_rating, total_reviews, sentiment, sources[] }
legal_records:         { status, findings[], sources[] }
osha_violations:       { status, violation_count, serious_count, findings[] }
ambiguous_candidates:  Array | null   // non-null only when risk_level === "AMBIGUOUS"
data_sources_searched: string[]
cached:                boolean
searches_performed:    number
processing_ms:         number
meta: {
  cost_usd:              number  // to 4 decimals
  tokens_in:             number
  tokens_out:            number
  cache_read_tokens:     number
  cache_creation_tokens: number
  searches_performed:    number
  processing_ms:         number
}
```

`searches_performed`, `processing_ms`, `cache_read_tokens`, `cache_creation_tokens`, and `cached` are also preserved as top-level fields for backward compatibility with existing clients; prefer `meta` for new integrations.

---

## AMBIGUOUS_IDENTITY behavior

When the queried name matches 3+ distinct entities in the queried metro, or the model cannot disambiguate from initial searches, the response is a disambiguation prompt rather than a trust score:

```jsonc
{
  "risk_level": "AMBIGUOUS",
  "trust_score": null,
  "confidence_level": "LOW",
  "summary": "Ambiguous identity: 'Smith Construction' matches 5+ distinct entities in the Denver/Colorado metro...",
  "business_registration": { "status": "UNKNOWN", ... },
  "ambiguous_candidates": [
    { "name": "...", "entity_id": "...", "address": "...", "principal": "...", "formation_year": 1977, "distinguishing_note": "..." },
    ...  // 3–5 entries
  ]
}
```

**To resolve:** re-query with one or more of `address`, `principal`, `license_number`, `ein_last4` pulled from a chosen candidate. The cache key includes a hash of the hints, so the re-query is guaranteed to bypass the earlier ambiguous cache entry.

---

## Rate limits & cost caps

- **Rate limit (Supabase RPC `check_trust_rate_limit`):**
  - `free` tier: 5 req / 60s per user (or per IP if anonymous).
  - `pro` / `enterprise`: 20 req / 60s per user.
- **Daily cost cap (Supabase RPC `check_trust_daily_cost_cap`):**
  - Anonymous pool: `TRUST_ANON_DAILY_CAP_USD` env var, default `$50/day`.
  - Authenticated user: `TRUST_USER_DAILY_CAP_USD` env var, default `$25/day`.
- **429 response** for either breach:
  ```
  Daily lookup limit reached ($<used> / $<cap>). Resets at midnight UTC.
  ```

---

## Typical cost

- Baseline non-class query: **~$0.25** (7 searches, 1–2 iterations, system prompt cache hit on iterations 2+).
- ROOFER_CLASS or MULTI_STATE_STORM_CORRIDOR path: **~$1.00–$1.20** (8–12 searches, multiple iterations, full cache read path).

Cost is surfaced in `meta.cost_usd` on every response.

---

## Examples

### Baseline query

```
curl -sS -X POST https://earthmove.io/api/trust \
  -H 'Content-Type: application/json' \
  -d '{"contractor_name":"PCL Construction Services","city":"Denver","state_code":"CO"}'
```

Returns a scored report (LOW / 78) with no ambiguity and no class cap.

### Query with disambiguation hints

```
curl -sS -X POST https://earthmove.io/api/trust \
  -H 'Content-Type: application/json' \
  -d '{
    "contractor_name": "Golden Triangle Construction",
    "city": "Denver",
    "state_code": "CO",
    "address": "9777 Pyramid Court, Suite 105, Englewood, CO",
    "principal": "Brian Laartz"
  }'
```

Resolves to a single entity that the name-only query returned as `AMBIGUOUS`, and surfaces entity-specific findings (e.g., active municipal litigation) that the ambiguous-bucket report hid.

### AMBIGUOUS response

A name-only query for `"Smith Construction"` in Denver:

```jsonc
{
  "risk_level": "AMBIGUOUS",
  "trust_score": null,
  "summary": "Ambiguous identity: 'Smith Construction' matches 5+ distinct entities in the Denver/Colorado metro...",
  "ambiguous_candidates": [
    { "name": "Smith & Smith Construction Colorado Corp", "principal": "Nicholas Smith, Owner", ... },
    { "name": "Smith Construction Inc",                    "principal": "Tony Smith, Owner",     ... },
    { "name": "Sean Smith Construction, Inc.",             "principal": "Sean Smith, Owner",     ... },
    { "name": "A Smith Construction Co",                   "principal": "Larry Smith, Owner",    ... },
    { "name": "DF Smith Construction",                     "principal": null,                    ... }
  ]
}
```

### Class-detection response

A query for `"Roof Squad Colorado"` in Denver:

```jsonc
{
  "risk_level": "MEDIUM",
  "trust_score": 68,
  "summary": "Roofer class, multi-state storm-corridor operator (TX/LA/CO/MS). Roof Squad Colorado operates as a DBA of Procore Remodeling LLC...",
  "red_flags": [
    "ROOFER CLASS / MULTI-STATE STORM-CORRIDOR OPERATOR: ...",
    "LICENSE EXPIRATION FLAG: ...",
    ...
  ]
}
```

Score capped at 70 by the `MULTI_STATE_STORM_CORRIDOR unresolved cross-AG` rule; summary opens with the class-ID sentence per the Step 6 output contract.
