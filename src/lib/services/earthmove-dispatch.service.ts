import { createAdminClient } from '../supabase/server'
import { createDispatchClient } from '../supabase/dispatch-db'
import twilio from 'twilio'

interface DispatchResult {
  success: boolean
  dispatchOrderId?: string
  driversNotified: number
  cityName: string
  error?: string
}

const DEFAULT_DRIVER_PAY_CENTS = 4000
const LARGE_ORDER_THRESHOLD = 500
const MAX_DRIVERS_PER_DISPATCH = 500

const CITY_RATES: Record<string, number> = {
  'Dallas': 4000, 'Fort Worth': 4000, 'Arlington': 4000,
  'Denver': 4500, 'Houston': 4000, 'Austin': 4500,
  'Phoenix': 3500, 'Las Vegas': 3500, 'Atlanta': 4000,
  'Orlando': 3500, 'Tampa': 3500, 'Charlotte': 4000,
}

function getDriverPayCents(cityName: string, dbPayCents?: number | null): number {
  if (dbPayCents && dbPayCents > 0) return dbPayCents
  return CITY_RATES[cityName] ?? DEFAULT_DRIVER_PAY_CENTS
}

function e164(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return `+1${d}`
}

interface DispatchDriver {
  phone: string; tierSlug: string; dispatchId: string
  cityName: string; yardsNeeded: number; payDollars: number
  materialName: string; haulDate: string
}

async function batchDispatchSMS(drivers: DispatchDriver[]): Promise<{ sent: number; failed: number }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.EARTHMOVE_TWILIO_FROM || process.env.TWILIO_FROM_NUMBER_2 || process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[earthmove-dispatch] Twilio not configured')
    return { sent: 0, failed: 0 }
  }

  const client = twilio(accountSid, authToken)
  let sent = 0, failed = 0

  const tierOrder = ['elite', 'pro', 'hauler', 'trial']
  const tierDelay: Record<string, number> = { elite: 0, pro: 200, hauler: 400, trial: 600 }
  const sorted = [...drivers].sort((a, b) => tierOrder.indexOf(a.tierSlug) - tierOrder.indexOf(b.tierSlug))

  let lastTier = ''
  for (const d of sorted) {
    if (!d.phone) continue
    if (d.tierSlug !== lastTier) {
      const delay = tierDelay[d.tierSlug] ?? 0
      if (delay > 0) await new Promise(r => setTimeout(r, delay))
      lastTier = d.tierSlug
    }

    const msg = [
      `EarthMove: ${d.materialName} delivery`,
      `${d.cityName} — ${d.yardsNeeded} ${d.yardsNeeded > 1 ? 'tons' : 'ton'} — $${d.payDollars}/load`,
      `${d.haulDate}`,
      `Reply YES to claim. First driver wins.`,
    ].join('\n')

    try {
      await client.messages.create({ body: msg, from: fromNumber, to: e164(d.phone) })
      sent++
    } catch (err: any) {
      console.error(`[earthmove-dispatch] SMS to ${d.phone} failed:`, err?.message)
      failed++
    }
  }
  return { sent, failed }
}

export async function dispatchWebOrder(orderId: string): Promise<DispatchResult> {
  const earthmoveDb = createAdminClient()
  const dispatchDb = createDispatchClient()

  try {
    const { data: order, error: orderErr } = await earthmoveDb
      .from('orders').select('*, dispatch:dispatch_queue(*)').eq('id', orderId).single()

    if (orderErr || !order) {
      return { success: false, driversNotified: 0, cityName: '', error: 'Order not found' }
    }

    const { data: existing } = await dispatchDb
      .from('dispatch_orders').select('id').eq('web_order_id', orderId).maybeSingle()
    if (existing) {
      return { success: true, dispatchOrderId: existing.id, driversNotified: 0, cityName: '', error: 'Already dispatched' }
    }

    const marketName = order.market_id
      ? (await earthmoveDb.from('markets').select('name').eq('id', order.market_id).single()).data?.name
      : null

    let cityId: string | null = null
    let cityName = ''
    let cityPayCents: number | null = null

    if (marketName) {
      const { data: cities } = await dispatchDb.from('cities').select('id, name, default_driver_pay_cents')
      if (cities) {
        const match = cities.find((c: any) =>
          marketName.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(marketName.toLowerCase().split('-')[0])
        )
        if (match) { cityId = match.id; cityName = match.name; cityPayCents = match.default_driver_pay_cents }
      }
    }

    if (!cityId) {
      const { data: defaultCity } = await dispatchDb.from('cities').select('id, name, default_driver_pay_cents').limit(1).single()
      if (defaultCity) { cityId = defaultCity.id; cityName = defaultCity.name; cityPayCents = defaultCity.default_driver_pay_cents }
    }

    if (!cityId) {
      return { success: false, driversNotified: 0, cityName: '', error: 'No city match' }
    }

    const driverPayCents = getDriverPayCents(cityName, cityPayCents)
    const materialName = order.material_name_snapshot || 'Material'

    const addr = order.delivery_address_snapshot as any
    const clientAddress = addr
      ? [addr.street_line_1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
      : (order.delivery_address || '')
    const deliveryLat = addr?.lat ? parseFloat(addr.lat) : null
    const deliveryLng = addr?.lng ? parseFloat(addr.lng) : null

    let pickupLat: number | null = null, pickupLng: number | null = null, pickupAddress = ''
    if (order.supply_yard_id) {
      const { data: yard } = await earthmoveDb
        .from('supply_yards').select('lat, lng, address_line_1, city, name').eq('id', order.supply_yard_id).single()
      if (yard) {
        pickupLat = yard.lat ? parseFloat(yard.lat) : null
        pickupLng = yard.lng ? parseFloat(yard.lng) : null
        pickupAddress = [yard.name, yard.address_line_1, yard.city].filter(Boolean).join(', ')
      }
    }

    const { data: dispatchOrder, error: dispatchErr } = await dispatchDb
      .from('dispatch_orders')
      .insert({
        client_name: order.guest_first_name || order.customer_name || 'Web Customer',
        client_phone: order.guest_phone || order.customer_phone || '',
        client_address: clientAddress,
        city_id: cityId,
        yards_needed: order.quantity || order.tons_needed || 0,
        price_quoted_cents: Math.round((order.total_amount || 0) * 100),
        driver_pay_cents: driverPayCents,
        notes: `EarthMove #${orderId.slice(0, 8)} — ${materialName} × ${order.quantity || order.tons_needed || 0} ${order.unit || 'tons'}`,
        urgency: 'standard',
        source: 'web',
        status: 'dispatching',
        web_order_id: orderId,
        material_type: materialName,
        material_qty: order.quantity || order.tons_needed,
        material_unit: order.unit || 'ton',
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        pickup_address: pickupAddress,
        delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLng,
      })
      .select('id').single()

    if (dispatchErr || !dispatchOrder) {
      console.error('[earthmove-dispatch] dispatch_orders insert failed:', dispatchErr)
      return { success: false, driversNotified: 0, cityName, error: 'Dispatch insert failed' }
    }

    const qty = order.quantity || order.tons_needed || 0
    if (qty >= LARGE_ORDER_THRESHOLD) {
      const adminPhone = process.env.ADMIN_PHONE?.replace(/\D/g, '')
      if (adminPhone) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
          await client.messages.create({
            body: `EarthMove LARGE ORDER: ${qty} ${order.unit || 'tons'} of ${materialName}. #${orderId.slice(0, 8)}`,
            from: process.env.EARTHMOVE_TWILIO_FROM || process.env.TWILIO_FROM_NUMBER!,
            to: e164(adminPhone),
          })
        } catch {}
      }
    }

    const { data: drivers } = await dispatchDb
      .from('driver_profiles')
      .select('user_id, first_name, phone, phone_verified, tiers(slug)')
      .eq('city_id', cityId).eq('status', 'active').eq('phone_verified', true)
      .limit(MAX_DRIVERS_PER_DISPATCH)

    if (!drivers || drivers.length === 0) {
      const adminPhone = process.env.ADMIN_PHONE?.replace(/\D/g, '')
      if (adminPhone) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
          await client.messages.create({
            body: `EarthMove: ${materialName} order in ${cityName} — NO DRIVERS. #${orderId.slice(0, 8)}`,
            from: process.env.EARTHMOVE_TWILIO_FROM || process.env.TWILIO_FROM_NUMBER!,
            to: e164(adminPhone),
          })
        } catch {}
      }
      return { success: true, dispatchOrderId: dispatchOrder.id, driversNotified: 0, cityName, error: 'No drivers' }
    }

    const smsPaused = process.env.PAUSE_DRIVER_DISPATCH_SMS === 'true'
    const haulDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const dispatchDrivers: DispatchDriver[] = drivers.map((d: any) => ({
      phone: d.phone, tierSlug: (d.tiers as any)?.slug || 'trial',
      dispatchId: dispatchOrder.id, cityName,
      yardsNeeded: qty, payDollars: Math.round(driverPayCents / 100),
      materialName, haulDate,
    }))

    let sent = 0, failed = 0
    if (smsPaused) {
      console.log(`[earthmove-dispatch] SMS PAUSED — ${dispatchDrivers.length} drivers skipped`)
    } else {
      const result = await batchDispatchSMS(dispatchDrivers)
      sent = result.sent; failed = result.failed
    }

    await dispatchDb.from('dispatch_orders').update({ drivers_notified: sent }).eq('id', dispatchOrder.id)

    await earthmoveDb.from('audit_events').insert({
      event_type: 'earthmove.dispatch.bridged', entity_type: 'orders', entity_id: orderId, actor_role: 'admin',
      payload: { dispatch_order_id: dispatchOrder.id, city: cityName, sent, failed, sms_paused: smsPaused, material: materialName },
    })

    console.log(`[earthmove-dispatch] ${orderId.slice(0, 8)} → ${dispatchOrder.id.slice(0, 8)} → ${sent} drivers in ${cityName}`)
    return { success: true, dispatchOrderId: dispatchOrder.id, driversNotified: sent, cityName }

  } catch (err) {
    console.error('[earthmove-dispatch] FATAL:', err)
    return { success: false, driversNotified: 0, cityName: '', error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function autoDispatchWebOrder(orderId: string): Promise<void> {
  try {
    const result = await dispatchWebOrder(orderId)
    console.log(`[earthmove-dispatch] Auto: ${orderId.slice(0, 8)} → ${result.driversNotified} notified in ${result.cityName}`)
  } catch (err) {
    console.error('[earthmove-dispatch] Auto failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// Driver dashboard v2 — reads/writes public.dispatches + public.dispatch_events.
// ─────────────────────────────────────────────────────────────
import type { Phase } from '../driver/phase-machine'

export async function getAvailableLoads(opts: { limit?: number } = {}) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dispatches')
    .select('id, material_type, tons, pickup_address, delivery_address, driver_pay, driver_bonus, is_backhaul, created_at, notes')
    .eq('status', 'pending')
    .is('driver_id', null)
    .order('created_at', { ascending: true })
    .limit(opts.limit ?? 20)
  if (error) throw error
  return data ?? []
}

export async function getActiveLoad(driverId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dispatches')
    .select('id, material_type, tons, pickup_address, delivery_address, driver_pay, driver_bonus, current_phase, status, is_backhaul, created_at, notes')
    .eq('driver_id', driverId)
    .neq('current_phase', 'ticket_submitted')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function advancePhase(input: {
  dispatch_id: string
  driver_id: string
  phase: Phase
  lat?: number | null
  lng?: number | null
  payload?: Record<string, unknown>
}) {
  const db = createAdminClient()
  const { error } = await db.from('dispatch_events').insert({
    dispatch_id: input.dispatch_id,
    driver_id:   input.driver_id,
    phase:       input.phase,
    lat:         input.lat ?? null,
    lng:         input.lng ?? null,
    source:      'driver_app',
    payload:     input.payload ?? {},
  })
  if (error) throw error
}

export async function getEarnings(driverId: string, since: Date) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dispatches')
    .select('driver_pay, driver_bonus')
    .eq('driver_id', driverId)
    .not('completed_at', 'is', null)
    .gte('completed_at', since.toISOString())
  if (error) throw error
  const total = (data ?? []).reduce((s: number, r: { driver_pay: number | null; driver_bonus: number | null }) =>
    s + Number(r.driver_pay || 0) + Number(r.driver_bonus || 0), 0)
  return { total, load_count: data?.length ?? 0 }
}

export type AvailableLoad = Awaited<ReturnType<typeof getAvailableLoads>>[number]
export type ActiveLoadRow = NonNullable<Awaited<ReturnType<typeof getActiveLoad>>>
