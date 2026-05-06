// src/lib/notify/twilio-sms.ts
// Pure HTTP Twilio sender — zero SDK dependency. Used by the ops pager.
// NEVER throws. Returns a result object so callers can log/audit and proceed.
// Required env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
//               OPS_PHONE_E164 (your phone in +1XXXXXXXXXX format).
// Missing env returns { delivered: false, error: 'env_missing' } and logs a
// warn — does not break the calling code path.

export interface OpsSmsResult {
  sid:       string | null
  to:        string
  delivered: boolean
  error?:    string
}

export async function sendOpsSms(body: string): Promise<OpsSmsResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER
  const to    = process.env.OPS_PHONE_E164

  if (!sid || !token || !from || !to) {
    console.warn('[ops-sms] env_missing', {
      has_sid: !!sid, has_token: !!token, has_from: !!from, has_to: !!to,
    })
    return { sid: null, to: to ?? '', delivered: false, error: 'env_missing' }
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[ops-sms] twilio_non_2xx', { status: res.status, text: text.slice(0, 500) })
      return { sid: null, to, delivered: false, error: `twilio_${res.status}` }
    }
    const data = (await res.json()) as { sid?: string }
    return { sid: data.sid ?? null, to, delivered: true }
  } catch (err) {
    console.error('[ops-sms] fetch_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return { sid: null, to, delivered: false, error: 'fetch_failed' }
  }
}
