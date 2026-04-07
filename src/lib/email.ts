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
