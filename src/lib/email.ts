import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/** HTML-escape untrusted user data before interpolating into email templates. */
function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}

interface OrderConfirmationData {
  customerEmail: string
  customerName: string
  orderId: string
  materialName: string
  quantity: number
  unit: string
  totalAmount: number
  deliveryAddress?: string
  deliveryType: string
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping order confirmation email')
    return
  }

  const shortId = data.orderId.slice(-8).toUpperCase()
  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.totalAmount / 100)
  const from = process.env.RESEND_FROM_EMAIL ?? 'orders@earthmove.io'
  const deliveryLabel = data.deliveryType === 'asap' ? 'same-day' : 'scheduled'
  const unitLabel = data.unit === 'cubic_yard' ? 'cubic yards' : 'tons'
  // Only linkify the order ID if it's a plausible UUID/slug, to keep the URL safe.
  const safeOrderIdForUrl = /^[A-Za-z0-9_-]+$/.test(data.orderId) ? data.orderId : ''

  try {
    await getResend().emails.send({
      from,
      to: data.customerEmail,
      subject: `Order Confirmed #${esc(shortId)} — EarthMove`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #059669; font-size: 24px; margin: 0;">EarthMove</h1>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 28px; margin-bottom: 8px;">&#10003;</div>
            <h2 style="color: #166534; font-size: 20px; margin: 0 0 4px;">Order Confirmed</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Order #${esc(shortId)}</p>
          </div>

          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Hi ${esc(data.customerName)},<br><br>
            Your order has been confirmed and is being prepared for ${deliveryLabel} delivery.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #111827; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">Material</td>
                <td style="color: #111827; font-weight: 600; text-align: right; padding: 6px 0;">${esc(data.materialName)}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">Quantity</td>
                <td style="color: #111827; font-weight: 600; text-align: right; padding: 6px 0;">${esc(data.quantity)} ${unitLabel}</td>
              </tr>
              ${data.deliveryAddress ? `
              <tr>
                <td style="color: #6b7280; padding: 6px 0;">Delivery to</td>
                <td style="color: #111827; font-weight: 600; text-align: right; padding: 6px 0;">${esc(data.deliveryAddress)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="color: #111827; font-weight: 700; padding: 12px 0 6px;">Total</td>
                <td style="color: #059669; font-weight: 700; font-size: 18px; text-align: right; padding: 12px 0 6px;">${formattedTotal}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://earthmove.io/orders/${safeOrderIdForUrl}" style="display: inline-block; background: #059669; color: white; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
              View Order Status
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 32px; line-height: 1.5;">
            Questions? Call us at (888) 555-DIRT or reply to this email.<br>
            EarthMove — Bulk materials delivered to your job site.
          </p>
        </div>
      `,
    })
    console.log(`[email] Order confirmation sent to ${data.customerEmail} for order ${shortId}`)
  } catch (err) {
    console.error('[email] Failed to send order confirmation:', err)
  }
}

interface GuestClaimAccountData {
  customerEmail: string
  customerName: string
  recoveryLink: string
  orderShortId: string
}

/**
 * Sent after a guest checkout completes. The user has a real auth.users row
 * (created silently during checkout) and this email gives them the link to
 * set a password and claim it. Promotes future repeat purchases without
 * forcing signup at the moment of checkout.
 */
export async function sendGuestClaimAccount(data: GuestClaimAccountData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping guest claim email')
    return
  }
  const from = process.env.RESEND_FROM_EMAIL ?? 'orders@earthmove.io'

  try {
    await getResend().emails.send({
      from,
      to: data.customerEmail,
      subject: 'Claim your EarthMove account — track this order & save on the next one',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #059669; font-size: 24px; margin: 0;">EarthMove</h1>
          </div>

          <h2 style="color: #111827; font-size: 22px; margin: 0 0 12px;">Claim your account, ${esc(data.customerName)}</h2>
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            We just emailed you the receipt for order #${esc(data.orderShortId)}. To track its status,
            re-order the same load with one tap, and unlock member-only deals, claim your account
            by setting a password below. Takes about 10 seconds.
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${esc(data.recoveryLink)}" style="display: inline-block; background: #059669; color: white; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
              Claim My Account
            </a>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #166534; font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.05em;">Member benefits</h3>
            <ul style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0; padding-left: 20px;">
              <li>Daily deal alerts on materials you order</li>
              <li>Free delivery on first 3 orders</li>
              <li>$10 back for every $500 spent</li>
              <li>SMS dispatch updates when your truck rolls</li>
              <li>One-tap reorder to the same job site</li>
            </ul>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 32px; line-height: 1.5;">
            This link expires in 24 hours. If you didn&apos;t place this order, ignore this email.<br>
            EarthMove — Bulk materials delivered to your job site.
          </p>
        </div>
      `,
    })
    console.log(`[email] Guest claim account sent to ${data.customerEmail}`)
  } catch (err) {
    console.error('[email] Failed to send guest claim email:', err)
  }
}

// ── Contact form ────────────────────────────────────────────────────────────

export interface ContactInquiryData {
  fullName: string
  email: string
  role: 'homeowner' | 'contractor' | 'driver' | 'supplier' | 'other'
  subject: string
  message: string
}

const CONTACT_NOTIFICATION_RECIPIENTS = [
  'support@filldirtnearme.net',
  'john@filldirtnearme.net',
] as const

const ROLE_LABEL: Record<ContactInquiryData['role'], string> = {
  homeowner:  'Homeowner',
  contractor: 'Contractor',
  driver:     'Driver / Hauler',
  supplier:   'Supplier / Yard',
  other:      'Other',
}

/**
 * Notify internal team when someone submits the /contact form.
 * Best-effort — the API endpoint persists the inquiry to audit_events so
 * leads survive transient Resend / network failures.
 */
export async function sendContactInquiry(data: ContactInquiryData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping contact inquiry email')
    return
  }
  const from = process.env.RESEND_FROM_EMAIL ?? 'orders@earthmove.io'
  const subject = `[Contact] ${data.subject} — ${data.fullName}`

  try {
    await getResend().emails.send({
      from,
      to: [...CONTACT_NOTIFICATION_RECIPIENTS],
      replyTo: data.email,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px 16px">
          <div style="margin-bottom:20px">
            <span style="display:inline-block;background:#f0fdf4;color:#059669;border:1px solid #bbf7d0;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:600">${esc(ROLE_LABEL[data.role])}</span>
          </div>
          <h2 style="color:#111827;font-size:20px;margin:0 0 4px">${esc(data.fullName)}</h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 8px">
            <a href="mailto:${esc(data.email)}" style="color:#059669;text-decoration:none">${esc(data.email)}</a>
          </p>
          <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Submitted via /contact</p>
          <h3 style="color:#111827;font-size:16px;margin:0 0 8px">${esc(data.subject)}</h3>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;color:#374151;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(data.message)}</div>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Reply to this email to respond directly.</p>
        </div>
      `,
    })
    console.log(`[email] Contact inquiry sent for ${data.email}`)
  } catch (err) {
    console.error('[email] Failed to send contact inquiry email:', err)
  }
}

// ── Join the network (driver + contractor) ─────────────────────────────────

export interface JoinLeadData {
  role: 'driver' | 'contractor'
  fullName: string
  companyName: string | null
  email: string
  phone: string
  primaryLocation: string | null
  yearsInBusiness: number | null
  /** Drivers: truck types. Contractors: equipment types. Multi-select. */
  primaryTypes: string[]
  /** Drivers: how many trucks. Contractors: how many pieces of equipment. */
  count: number | null
  availability: string[]
}

const JOIN_NOTIFICATION_RECIPIENTS = [
  'support@filldirtnearme.net',
  'john@filldirtnearme.net',
] as const

/**
 * Notify internal team when someone fills out the /join page.
 * Best-effort — Resend missing or transient failures don't block the API
 * response (the lead is still persisted via audit_events).
 */
export async function sendJoinLeadNotification(data: JoinLeadData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping join lead notification')
    return
  }
  const from = process.env.RESEND_FROM_EMAIL ?? 'orders@earthmove.io'
  const roleLabel = data.role === 'driver' ? 'Driver / Hauler' : 'Contractor / Earthwork Pro'
  const typeLabel = data.role === 'driver' ? 'Truck types' : 'Equipment types'
  const countLabel = data.role === 'driver' ? 'How many trucks' : 'How many pieces'
  const subject = `New ${roleLabel} signup — ${data.fullName}${data.companyName ? ` (${data.companyName})` : ''}`

  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:8px 12px;background:#f9fafb;font-weight:600;font-size:13px;color:#374151;border:1px solid #e5e7eb;width:38%;vertical-align:top">${esc(k)}</td>
      <td style="padding:8px 12px;font-size:14px;color:#111827;border:1px solid #e5e7eb;vertical-align:top">${v}</td>
    </tr>`

  try {
    await getResend().emails.send({
      from,
      to: [...JOIN_NOTIFICATION_RECIPIENTS],
      replyTo: data.email,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px 16px">
          <div style="margin-bottom:20px">
            <span style="display:inline-block;background:#f0fdf4;color:#059669;border:1px solid #bbf7d0;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:600">${esc(roleLabel)}</span>
          </div>
          <h2 style="color:#111827;font-size:20px;margin:0 0 4px">${esc(data.fullName)}${data.companyName ? ` <span style="color:#6b7280;font-weight:500">· ${esc(data.companyName)}</span>` : ''}</h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Submitted via /join</p>
          <table style="width:100%;border-collapse:collapse;font-family:inherit">
            ${row('Email', `<a href="mailto:${esc(data.email)}" style="color:#059669;text-decoration:none">${esc(data.email)}</a>`)}
            ${row('Phone', `<a href="tel:${esc(data.phone)}" style="color:#059669;text-decoration:none">${esc(data.phone)}</a>`)}
            ${data.primaryLocation ? row('Primary location', esc(data.primaryLocation)) : ''}
            ${data.yearsInBusiness != null ? row('Years in business', esc(data.yearsInBusiness)) : ''}
            ${data.primaryTypes.length > 0 ? row(typeLabel, data.primaryTypes.map(t => `<span style="display:inline-block;background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;font-size:13px">${esc(t)}</span>`).join('')) : ''}
            ${data.count != null ? row(countLabel, esc(data.count)) : ''}
            ${data.availability.length > 0 ? row('Availability', data.availability.map(a => `<span style="display:inline-block;background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;font-size:13px">${esc(a)}</span>`).join('')) : ''}
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">Reply to this email to contact ${esc(data.fullName)} directly.</p>
        </div>
      `,
    })
    console.log(`[email] Join lead notification sent for ${data.email} (${data.role})`)
  } catch (err) {
    console.error('[email] Failed to send join lead notification:', err)
  }
}
