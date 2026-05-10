/**
 * Phoenix-LLC + cross-entity fraud-network detector — patent claim 1.
 *
 * Given a canonical SOS entity (with principal_address + registered_agent
 * + officers), queries the same SOS dataset for OTHER entities that share
 * one of those identifiers. Surfaces three relationship types:
 *
 *   - phoenix_signal: shared identifier + related entity dissolved before
 *     the canonical formed. Strong fraud indicator (operator dissolved an
 *     entity then re-incarnated under a new one to escape the obligations).
 *   - same_operator: shared identifier + both currently active + formation
 *     dates within 2 years. Operator runs multiple entities under shared
 *     infrastructure — surface for confirmation.
 *   - address_neighbor: shared address only, no officer/agent overlap.
 *     Could be a coincidence (shared coworking space). Informational only.
 *
 * Wraps everything in try/catch — phoenix detection is opportunistic and
 * must not break the main report flow.
 */

import type { ScraperEvidence, TrustFindingType, TrustConfidence } from './types'

const SOURCE_KEY_CO = 'co_sos_biz'
const SOURCE_KEY_TX = 'tx_sos_biz'
const CO_ENDPOINT = 'https://data.colorado.gov/resource/4ykn-tg5h.json'
const TX_ENDPOINT = 'https://data.texas.gov/resource/9cir-efmm.json'
const RELATED_LIMIT = 10
const TIMEOUT_MS = 15_000
const CONFIDENCE: TrustConfidence = 'verified_structured'

export interface CanonicalEntity {
  source_key: 'co_sos_biz' | 'tx_sos_biz'
  entity_id: string
  entity_name: string
  principal_address: string | null
  registered_agent_name: string | null
  formation_date: string | null
}

export interface RelatedEntity {
  entity_name: string
  entity_id: string
  status: string | null
  formation_date: string | null
  dissolution_date: string | null
  shared_indicator: 'address' | 'officer' | 'agent'
  relationship_type: 'phoenix_signal' | 'same_operator' | 'address_neighbor'
  source_url: string
  similarity_score: number
}

interface CoSosRow {
  entityid?: string
  entityname?: string
  entitystatus?: string
  entityformdate?: string
  agentfirstname?: string
  agentlastname?: string
  principaladdress1?: string
}

interface TxRow {
  taxpayer_number?: string
  taxpayer_name?: string
  taxpayer_address?: string
  sos_charter_date?: string
  sos_status_code?: string
}

function buildAddressKey(addr: string | null): string | null {
  if (!addr) return null
  // Take first comma-separated segment (street + number) — coarser than
  // the full string but resilient to "St" vs "Street" + suite vs unit.
  const segment = addr.split(',')[0].trim()
  if (segment.length < 5) return null
  return segment.toUpperCase()
}

function buildAgentKey(agent: string | null): string | null {
  if (!agent) return null
  return agent.trim().toUpperCase()
}

function classifyRelationship(args: {
  canonical: CanonicalEntity
  candidate: { status: string | null; formation_date: string | null; dissolution_date: string | null }
  shared: 'address' | 'officer' | 'agent'
}): RelatedEntity['relationship_type'] {
  const status = (args.candidate.status ?? '').trim().toLowerCase()
  const dissolved = ['dissolved', 'voluntarily dissolved', 'cancelled', 'forfeited', 'withdrawn'].includes(status)
    || args.candidate.dissolution_date !== null
  const candFormation = args.candidate.formation_date ? Date.parse(args.candidate.formation_date) : null
  const canonFormation = args.canonical.formation_date ? Date.parse(args.canonical.formation_date) : null
  const candDissolution = args.candidate.dissolution_date ? Date.parse(args.candidate.dissolution_date) : null

  // Phoenix signal: shared non-address identifier + candidate is dead.
  // We also fire when canonical formed AFTER candidate's formation by 2+
  // years even without explicit dissolution_date — the gap pattern itself
  // is the signal.
  if (dissolved && args.shared !== 'address') {
    if (candDissolution && canonFormation && canonFormation > candDissolution) {
      return 'phoenix_signal'
    }
    // No dissolution_date but status says dissolved — phoenix if canonical
    // formed reasonably after candidate.
    if (candFormation && canonFormation && canonFormation > candFormation) {
      return 'phoenix_signal'
    }
  }

  if (status === 'good standing' || status === 'active') {
    if (candFormation && canonFormation) {
      const yearsApart = Math.abs(candFormation - canonFormation) / (1000 * 60 * 60 * 24 * 365)
      if (yearsApart <= 2 && args.shared !== 'address') {
        return 'same_operator'
      }
    }
  }
  return 'address_neighbor'
}

async function fetchCoCandidates(
  canonical: CanonicalEntity,
  fetchFn: typeof fetch,
): Promise<RelatedEntity[]> {
  const out: RelatedEntity[] = []
  const addrKey = buildAddressKey(canonical.principal_address)
  const agentKey = buildAgentKey(canonical.registered_agent_name)

  const wheres: Array<{ clause: string; shared: 'address' | 'agent' }> = []
  if (addrKey) wheres.push({ clause: `upper(principaladdress1) like '%${addrKey.replace(/'/g, "''")}%'`, shared: 'address' })
  if (agentKey) {
    const escaped = agentKey.replace(/'/g, "''")
    wheres.push({ clause: `upper(agentfirstname || ' ' || agentlastname) like '%${escaped}%'`, shared: 'agent' })
  }

  // Dedupe by (entity_id, shared_indicator) so an entity matched via both
  // address AND agent gets two relationship classifications surfaced (the
  // builder upgrades to the strongest one). Canonical entity is dropped.
  const seenPairs = new Set<string>()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (const { clause, shared } of wheres) {
      const url = `${CO_ENDPOINT}?$where=${encodeURIComponent(clause)}&$limit=${RELATED_LIMIT}`
      const resp = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
      if (!resp.ok) continue
      const rows = (await resp.json()) as CoSosRow[]
      for (const row of rows) {
        const id = (row.entityid ?? '').trim()
        if (!id || id === canonical.entity_id) continue
        const pairKey = `${id}::${shared}`
        if (seenPairs.has(pairKey)) continue
        seenPairs.add(pairKey)
        const candidate = {
          entity_name: (row.entityname ?? '').trim(),
          entity_id: id,
          status: (row.entitystatus ?? null) as string | null,
          formation_date: row.entityformdate ?? null,
          dissolution_date: null, // CO SOS dataset doesn't expose dissolution_date — inferred from status
        }
        if (!candidate.entity_name) continue
        const relationship = classifyRelationship({ canonical, candidate, shared })
        out.push({
          ...candidate,
          shared_indicator: shared,
          relationship_type: relationship,
          source_url: url,
          similarity_score: 1,
        })
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return out.slice(0, RELATED_LIMIT)
}

async function fetchTxCandidates(
  canonical: CanonicalEntity,
  fetchFn: typeof fetch,
): Promise<RelatedEntity[]> {
  const out: RelatedEntity[] = []
  const addrKey = buildAddressKey(canonical.principal_address)
  if (!addrKey) return out
  const url = `${TX_ENDPOINT}?$where=${encodeURIComponent(`upper(taxpayer_address) like '%${addrKey.replace(/'/g, "''")}%'`)}&$limit=${RELATED_LIMIT}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const seen = new Set<string>([canonical.entity_id])

  try {
    const resp = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!resp.ok) return out
    const rows = (await resp.json()) as TxRow[]
    for (const row of rows) {
      const id = (row.taxpayer_number ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const candidate = {
        entity_name: (row.taxpayer_name ?? '').trim(),
        entity_id: id,
        status: (row.sos_status_code ?? null) as string | null,
        formation_date: row.sos_charter_date ?? null,
        dissolution_date: null,
      }
      if (!candidate.entity_name) continue
      const relationship = classifyRelationship({ canonical, candidate, shared: 'address' })
      out.push({
        ...candidate,
        shared_indicator: 'address',
        relationship_type: relationship,
        source_url: url,
        similarity_score: 1,
      })
    }
  } catch {
    /* opportunistic */
  } finally {
    clearTimeout(timer)
  }
  return out.slice(0, RELATED_LIMIT)
}

export interface DetectPhoenixOpts {
  fetchFn?: typeof fetch
}

export async function detectPhoenixPattern(
  canonical: CanonicalEntity,
  opts: DetectPhoenixOpts = {},
): Promise<RelatedEntity[]> {
  const fetchFn = opts.fetchFn ?? fetch
  try {
    if (canonical.source_key === SOURCE_KEY_CO) return await fetchCoCandidates(canonical, fetchFn)
    if (canonical.source_key === SOURCE_KEY_TX) return await fetchTxCandidates(canonical, fetchFn)
    return []
  } catch (err) {
    console.warn('[phoenix-detector] detection failed', { canonical: canonical.entity_name, err: (err as Error)?.message })
    return []
  }
}

/**
 * Convert a RelatedEntity[] into ScraperEvidence rows for persistence
 * via the existing append_trust_evidence chain. The orchestrator emits
 * one finding_type per entity based on relationship_type:
 *   phoenix_signal → 'phoenix_signal'
 *   same_operator → 'officer_match'
 *   address_neighbor → 'address_reuse'
 */
export function relatedEntitiesToEvidence(
  related: RelatedEntity[],
  canonical: CanonicalEntity,
): ScraperEvidence[] {
  return related.map((r) => {
    const findingType: TrustFindingType =
      r.relationship_type === 'phoenix_signal' ? 'phoenix_signal'
      : r.relationship_type === 'same_operator' ? 'officer_match'
      : 'address_reuse'
    return {
      source_key: 'system_internal',
      finding_type: findingType,
      confidence: CONFIDENCE,
      finding_summary:
        `${r.relationship_type.replace('_', ' ')}: ${r.entity_name} ` +
        `(${r.status ?? 'unknown'}, formed ${r.formation_date ?? 'unknown'}) ` +
        `shares ${r.shared_indicator} with ${canonical.entity_name}`,
      extracted_facts: {
        entity_name: r.entity_name,
        entity_id: r.entity_id,
        status: r.status,
        formation_date: r.formation_date,
        dissolution_date: r.dissolution_date,
        shared_indicator: r.shared_indicator,
        relationship_type: r.relationship_type,
        source_url: r.source_url,
        canonical_entity_id: canonical.entity_id,
        canonical_entity_name: canonical.entity_name,
      },
      query_sent: r.source_url,
      response_sha256: null,
      response_snippet: null,
      duration_ms: 0,
      cost_cents: 0,
    }
  })
}
