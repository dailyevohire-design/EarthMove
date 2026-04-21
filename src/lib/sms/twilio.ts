import { validateRequest } from 'twilio'
import { createAdminClient } from '@/lib/supabase/server'

export function getDispatchFromNumber(): string {
  const n =
    process.env.EARTHMOVE_TWILIO_FROM ||
    process.env.TWILIO_FROM_NUMBER_2 ||
    process.env.TWILIO_FROM_NUMBER
  if (!n) throw new Error('No Twilio dispatch From number configured')
  return n
}

export function getAuthToken(): string {
  const t = process.env.TWILIO_AUTH_TOKEN
  if (!t) throw new Error('TWILIO_AUTH_TOKEN not set')
  return t
}

export function validateTwilioSignature(args: {
  signature: string | null
  publicUrl: string
  params: Record<string, string>
}): boolean {
  if (!args.signature) return false
  try {
    return validateRequest(getAuthToken(), args.signature, args.publicUrl, args.params)
  } catch {
    return false
  }
}

export interface EnqueueOutboundInput {
  phoneE164: string
  body: string
  reason: string
  dispatchId?: string | null
  metadata?: Record<string, unknown>
}

export async function enqueueOutbound(input: EnqueueOutboundInput): Promise<{ outbox_id: number }> {
  const supa = createAdminClient()
  const payload = {
    phone: input.phoneE164,
    body: input.body,
    reason: input.reason,
    dispatch_id: input.dispatchId ?? null,
    metadata: input.metadata ?? {},
  }
  const { data, error } = await supa
    .from('outbox_events')
    .insert({ event_type: 'driver_sms', payload })
    .select('id')
    .single()
  if (error) throw new Error(`enqueueOutbound failed: ${error.message}`)
  return { outbox_id: data.id as number }
}
