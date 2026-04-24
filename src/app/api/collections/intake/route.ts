import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { assertCollectionsEnabled, isCollectionsEnabled } from '@/lib/collections/feature-flag'
import { IntakeSchema, validateIntake } from '@/lib/collections/validation'
import { isSupportedCounty } from '@/lib/collections/county-assessors'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isCollectionsEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  assertCollectionsEnabled()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const parseResult = IntakeSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'invalid_input', issues: parseResult.error.issues.slice(0, 10) },
      { status: 400 },
    )
  }
  const input = parseResult.data

  const check = validateIntake(input)
  if (!check.ok) {
    return NextResponse.json({ error: check.error, message: check.message }, { status: check.status })
  }
  const warnings = check.warnings.slice()

  if (!isSupportedCounty(input.state_code, input.property_county)) {
    warnings.unshift(
      `${input.property_county} is not in the v0 supported-county list for ${input.state_code}. You may still proceed, but owner-lookup help will be limited.`,
    )
  }

  const priceId = process.env.STRIPE_PRICE_COLLECTIONS_ASSIST
  if (!priceId) {
    console.error('[collections/intake] missing STRIPE_PRICE_COLLECTIONS_ASSIST')
    return NextResponse.json({ error: 'stripe_price_not_configured' }, { status: 500 })
  }

  const admin = createAdminClient()

  // Insert case row as draft
  const { data: inserted, error: insErr } = await admin
    .from('collections_cases')
    .insert({
      user_id:                  user.id,
      status:                   'draft',
      state_code:               input.state_code,
      contractor_role:          input.contractor_role,
      property_type:            input.property_type,
      is_homestead:             input.is_homestead,
      claimant_name:            input.claimant_name,
      claimant_address:         input.claimant_address,
      claimant_phone:           input.claimant_phone ?? null,
      claimant_email:           input.claimant_email ?? null,
      claimant_entity_type:     input.claimant_entity_type ?? null,
      respondent_name:          input.respondent_name,
      respondent_address:       input.respondent_address,
      respondent_relationship:  input.respondent_relationship ?? null,
      property_street_address:  input.property_street_address,
      property_city:            input.property_city,
      property_state:           input.property_state,
      property_zip:             input.property_zip,
      property_county:          input.property_county,
      property_legal_description: input.property_legal_description ?? null,
      property_owner_name:      input.property_owner_name ?? null,
      property_owner_address:   input.property_owner_address ?? null,
      owner_lookup_method:      input.owner_lookup_method ?? null,
      owner_lookup_source_url:  input.owner_lookup_source_url ?? null,
      original_contract_signed_date:         input.original_contract_signed_date ?? null,
      original_contract_both_spouses_signed: input.original_contract_both_spouses_signed ?? null,
      work_description:   input.work_description,
      first_day_of_work:  input.first_day_of_work,
      last_day_of_work:   input.last_day_of_work,
      amount_owed_cents:  input.amount_owed_cents,
      pre_lien_notices_sent: input.pre_lien_notices_sent ?? [],
    })
    .select('id, user_id, state_code')
    .single()

  if (insErr || !inserted) {
    console.error('[collections/intake] insert failed', insErr)
    return NextResponse.json({ error: 'case_insert_failed' }, { status: 500 })
  }

  await admin.from('collections_case_events').insert({
    case_id:        inserted.id,
    event_type:     'intake_submitted',
    event_payload:  { warnings, state: input.state_code, contractor_role: input.contractor_role },
    actor_user_id:  user.id,
  })

  // Build Stripe Checkout session
  const origin = req.nextUrl.origin
  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email ?? undefined,
        client_reference_id: user.id,
        metadata: {
          product_family: 'collections',
          case_id:        inserted.id,
          user_id:        user.id,
          state_code:     input.state_code,
        },
        payment_intent_data: {
          metadata: {
            product_family: 'collections',
            case_id:        inserted.id,
            user_id:        user.id,
            state_code:     input.state_code,
          },
        },
        success_url: `${origin}/collections/${inserted.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}/collections/${inserted.id}?checkout=cancelled`,
        automatic_tax: { enabled: false },
      },
      { idempotencyKey: `coll_intake_${inserted.id}` },
    )

    if (!session.url) {
      console.error('[collections/intake] stripe returned no url', { sessionId: session.id })
      return NextResponse.json({ error: 'stripe_no_url' }, { status: 500 })
    }

    await admin
      .from('collections_cases')
      .update({
        status: 'pending_payment',
        stripe_checkout_session_id: session.id,
      })
      .eq('id', inserted.id)

    await admin.from('collections_case_events').insert({
      case_id:        inserted.id,
      event_type:     'checkout_started',
      event_payload:  { session_id: session.id },
      actor_user_id:  user.id,
    })

    return NextResponse.json({
      case_id:      inserted.id,
      checkout_url: session.url,
      warnings,
    })
  } catch (err) {
    console.error('[collections/intake] stripe create failed', err)
    return NextResponse.json({ error: 'stripe_failed' }, { status: 500 })
  }
}
