import { createAdminClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export type ConsentType = 'dispatch_only' | 'dispatch_plus_location' | 'marketing' | 'carrier_location'
export type RevocationScope = 'this_campaign' | 'all_campaigns' | 'specific_category'

export function toE164(phone: string): string {
  const raw = phone.trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+') && digits.length >= 11) return `+${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  throw new Error(`Invalid US phone: ${phone}`)
}

export function fromE164(e164: string): string {
  if (!e164.startsWith('+1') || e164.length !== 12) {
    throw new Error(`Not a US E.164 number: ${e164}`)
  }
  const d = e164.slice(2)
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

export async function hasActiveConsent(phoneE164: string, consentType: ConsentType): Promise<boolean> {
  try {
    const supa = createAdminClient()
    const { data, error } = await supa
      .from('sms_consent_current')
      .select('currently_consented')
      .eq('phone_e164', phoneE164)
      .eq('consent_type', consentType)
      .maybeSingle()
    if (error) {
      console.error('[hasActiveConsent] query error', { phoneE164, consentType, error: error.message })
      return false
    }
    return data?.currently_consented === true
  } catch (e) {
    console.error('[hasActiveConsent] exception', { phoneE164, consentType, e })
    return false
  }
}

export interface RecordRevokeInput {
  phone: string
  scope: RevocationScope
  consentType?: ConsentType
  keyword: string
  evidence: Record<string, unknown>
  ipInet?: string | null
  userAgent?: string | null
}

export async function recordRevoke(input: RecordRevokeInput): Promise<{ ids: string[] }> {
  const supa = createAdminClient()
  const e164 = toE164(input.phone)
  const now = new Date().toISOString()
  const types: ConsentType[] =
    input.scope === 'all_campaigns'
      ? ['dispatch_only', 'dispatch_plus_location', 'marketing', 'carrier_location']
      : input.consentType
      ? [input.consentType]
      : ['dispatch_plus_location']

  const rows = types.map((t) => ({
    phone_e164: e164,
    event_type: 'revoke' as const,
    consent_type: t,
    method: 'sms_reply_start' as const,
    revocation_keyword: input.keyword,
    revocation_scope: input.scope,
    revocation_processed_at: now,
    evidence: input.evidence,
    e_sign_attested: false,
    ip_inet: input.ipInet ?? null,
    user_agent: input.userAgent ?? null,
    recorded_by: 'inngest:dispatch_sms_state_machine',
    occurred_at: now,
    recorded_at: now,
  }))

  const { data, error } = await supa.from('sms_consent').insert(rows).select('id')
  if (error) throw new Error(`recordRevoke failed: ${error.message}`)
  return { ids: (data ?? []).map((r: { id: string }) => r.id) }
}

export interface RecordGrantByReplyInput {
  phone: string
  consentType: ConsentType
  disclosureVersion: string
  disclosureTextSha256: string
  disclosureTextFull: string
  keyword: string
  evidence: Record<string, unknown>
}

export async function recordGrantByReply(input: RecordGrantByReplyInput): Promise<{ id: string }> {
  const supa = createAdminClient()
  const e164 = toE164(input.phone)
  const now = new Date().toISOString()
  const { data, error } = await supa
    .from('sms_consent')
    .insert({
      phone_e164: e164,
      event_type: 'grant',
      consent_type: input.consentType,
      method: 'sms_reply_start',
      disclosure_version: input.disclosureVersion,
      disclosure_text_sha256: input.disclosureTextSha256,
      disclosure_text_full: input.disclosureTextFull,
      revocation_keyword: input.keyword,
      evidence: input.evidence,
      e_sign_attested: false,
      recorded_by: 'inngest:dispatch_sms_state_machine',
      occurred_at: now,
      recorded_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(`recordGrantByReply failed: ${error.message}`)
  return { id: data.id }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}
