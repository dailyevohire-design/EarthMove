'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/contractor/PageHead'
import { StickySummary } from '@/components/contractor/StickySummary'
import { WizardStepper } from './WizardStepper'
import { Step1Material, type MaterialOption } from './Step1Material'
import { Step2Quantity } from './Step2Quantity'
import { Step3Supplier } from './Step3Supplier'
import { Step4Address, type AddressRow, type ProjectOption } from './Step4Address'
import { Step5Review } from './Step5Review'
import type { OrderDraftPayload } from '@/lib/contractor/wizard-state'
import { canAdvance } from '@/lib/contractor/wizard-state'
import type { MatchedSupplier } from '@/lib/services/place-order.service'

type Props = {
  profileId: string
  profileZip?: string | null
  canPlaceOrders: boolean
  spendLimitCents: number | null
  draftId: string
  initialPayload: OrderDraftPayload
  initialStep: 1 | 2 | 3 | 4 | 5
  materials: MaterialOption[]
  addresses: AddressRow[]
  projects: ProjectOption[]
}

const PLATFORM_FEE_RATE = 0.09

export function WizardClient(p: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(p.initialStep)
  const [payload, setPayload] = useState<OrderDraftPayload>(p.initialPayload)
  const [addresses, setAddresses] = useState<AddressRow[]>(p.addresses)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // Autosave: debounce 2s after last edit, hard-flush every 10s.
  const pendingRef = useRef<OrderDraftPayload | null>(null)
  const pendingStepRef = useRef<number>(step)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const flush = useCallback(async () => {
    const body = pendingRef.current
    if (!body) return
    pendingRef.current = null
    setAutosaveState('saving')
    try {
      const res = await fetch(`/api/contractor/drafts/${p.draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: pendingStepRef.current, payload: body }),
      })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        setLastSavedAt(humanTimeFrom(j.saved_at))
        setAutosaveState('saved')
      } else {
        setAutosaveState('idle')
      }
    } catch {
      setAutosaveState('idle')
    }
  }, [p.draftId])

  useEffect(() => {
    heartbeatTimer.current = setInterval(() => { if (pendingRef.current) flush() }, 10_000)
    return () => { if (heartbeatTimer.current) clearInterval(heartbeatTimer.current) }
  }, [flush])

  function schedule(next: OrderDraftPayload, nextStep = step) {
    pendingRef.current = next
    pendingStepRef.current = nextStep
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => flush(), 2000)
  }

  function patch(next: OrderDraftPayload) {
    setPayload(next)
    schedule(next, step)
  }

  function gotoStep(n: 1 | 2 | 3 | 4 | 5) {
    setStep(n)
    schedule(payload, n)
  }

  const s1 = payload.step1
  const s2 = payload.step2
  const s3 = payload.step3
  const s4 = payload.step4

  const densityForSelected = useMemo(() => {
    if (!s1?.material_catalog_id) return null
    const m = p.materials.find(x => x.id === s1.material_catalog_id)
    return m?.default_unit === 'cuyd' ? 1 : null  // density stored per-material; surfaced below
  }, [s1?.material_catalog_id, p.materials])

  // Totals preview for summary + review
  const preview = useMemo(() => {
    const qty = s2?.quantity ?? 0
    const price = s3?.price_per_unit ?? 0
    const deliveryFee = s3?.delivery_fee ?? 0
    const subtotal = qty * price
    const platformFee = subtotal * PLATFORM_FEE_RATE
    const total = subtotal + deliveryFee + platformFee
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      total: Math.round(total * 100) / 100,
    }
  }, [s2?.quantity, s3?.price_per_unit, s3?.delivery_fee])

  const requiresApproval =
    p.spendLimitCents != null && Math.round(preview.total * 100) > p.spendLimitCents

  async function submit() {
    if (!canAdvance(payload, 4)) return
    if (!s1 || !s2 || !s3 || !s4?.delivery_address_id) return
    setSubmitting(true); setSubmitErr(null)
    try {
      const res = await fetch('/api/contractor/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: p.draftId,
          material_catalog_id: s1.material_catalog_id,
          supplier_offering_id: s3.supplier_offering_id,
          supply_yard_id: s3.supply_yard_id,
          quantity: s2.quantity,
          unit: s2.unit,
          delivery_address_id: s4.delivery_address_id,
          project_id: s4.project_id ?? null,
          requested_delivery_date: s4.requested_delivery_date ?? null,
          delivery_notes: s4.delivery_notes ?? null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Order failed')
      router.push(`/dashboard/contractor/orders/${body.order_id}`)
    } catch (e: any) {
      setSubmitErr(e.message)
      setSubmitting(false)
    }
  }

  const materialName = s1 && p.materials.find(m => m.id === s1.material_catalog_id)?.name || ''
  const materialSlug = s1 && p.materials.find(m => m.id === s1.material_catalog_id)?.slug || ''

  const selectedAddress = s4?.delivery_address_id
    ? addresses.find(a => a.id === s4.delivery_address_id)
    : undefined
  const deliveryAddressStr = selectedAddress
    ? `${selectedAddress.street_line_1}, ${selectedAddress.city} ${selectedAddress.state} ${selectedAddress.zip}`
    : '—'

  const mayAdvance = canAdvance(payload, step)

  return (
    <>
      <PageHead
        kicker="New order"
        title={<>Place an <em>order</em></>}
        subtitle="Autosaved as you go. Resume from any device."
      />

      <WizardStepper step={step} />

      <div className="ec-wizard">
        <div className="ec-wizard__main">
          {step === 1 && (
            <Step1Material
              materials={p.materials}
              value={{ material_catalog_id: s1?.material_catalog_id }}
              onChange={(m) => patch({
                ...payload,
                step1: {
                  material_catalog_id: m.id,
                  material_name: m.name,
                  material_slug: m.slug,
                  default_unit: m.default_unit,
                },
                // reset downstream steps that depend on material
                step2: payload.step2 ? { ...payload.step2, unit: m.default_unit } : undefined,
                step3: undefined,
              })}
            />
          )}

          {step === 2 && s1 && (
            <Step2Quantity
              value={{ quantity: s2?.quantity, unit: s2?.unit ?? s1.default_unit ?? 'ton' }}
              onChange={(v) => patch({ ...payload, step2: v, step3: undefined })}
              densityTonsPerCuyd={densityForSelected}
            />
          )}

          {step === 3 && s1 && s2 && (
            <Step3Supplier
              materialId={s1.material_catalog_id}
              quantity={s2.quantity}
              unit={s2.unit}
              zip={p.profileZip ?? undefined}
              value={{ supplier_offering_id: s3?.supplier_offering_id }}
              onChange={(m: MatchedSupplier) => patch({
                ...payload,
                step3: {
                  supplier_offering_id: m.offering_id,
                  supply_yard_id: m.supply_yard_id,
                  supplier_id: m.supplier_id,
                  supplier_name: m.supplier_name,
                  yard_name: m.yard_name,
                  price_per_unit: m.price_per_unit,
                  delivery_fee: m.estimated_delivery_fee ?? 0,
                },
              })}
            />
          )}

          {step === 4 && (
            <Step4Address
              addresses={addresses}
              projects={p.projects}
              profileId={p.profileId}
              value={{
                delivery_address_id: s4?.delivery_address_id,
                project_id: s4?.project_id,
                requested_delivery_date: s4?.requested_delivery_date,
                delivery_notes: s4?.delivery_notes,
              }}
              onChange={(v) => patch({ ...payload, step4: v })}
              onAddressAdded={(a) => setAddresses([a, ...addresses])}
            />
          )}

          {step === 5 && s1 && s2 && s3 && s4 && (
            <Step5Review
              materialName={materialName}
              supplierName={s3.supplier_name}
              yardName={s3.yard_name}
              quantity={s2.quantity}
              unit={s2.unit}
              pricePerUnit={s3.price_per_unit}
              deliveryFee={preview.deliveryFee}
              subtotal={preview.subtotal}
              platformFee={preview.platformFee}
              total={preview.total}
              deliveryAddress={deliveryAddressStr}
              deliveryDate={s4.requested_delivery_date}
              deliveryNotes={s4.delivery_notes}
              requiresApproval={requiresApproval}
              submitting={submitting}
              onSubmit={submit}
            />
          )}

          {submitErr && <div style={{ color: 'var(--clay-700)', marginTop: 10 }}>{submitErr}</div>}

          <div className="ec-wizard-nav">
            <button
              type="button"
              className="ec-btn ec-btn--secondary"
              onClick={() => gotoStep(Math.max(1, step - 1) as 1 | 2 | 3 | 4 | 5)}
              disabled={step === 1}
            >
              ← Back
            </button>
            {step < 5 ? (
              <button
                type="button"
                className="ec-btn ec-btn--primary"
                onClick={() => gotoStep(Math.min(5, step + 1) as 1 | 2 | 3 | 4 | 5)}
                disabled={!mayAdvance || !p.canPlaceOrders}
              >
                Continue →
              </button>
            ) : <span />}
          </div>
        </div>

        <div className="ec-wizard__aside">
          <StickySummary
            materialSlug={materialSlug}
            materialName={materialName || undefined}
            quantity={s2?.quantity}
            unit={s2?.unit}
            supplierName={s3?.supplier_name}
            yardName={s3?.yard_name ?? null}
            pricePerUnit={s3?.price_per_unit}
            deliveryFee={s3?.delivery_fee ?? null}
            deliveryDate={s4?.requested_delivery_date ?? null}
            total={preview.total > 0 ? preview.total : null}
            autosaveState={autosaveState}
            lastSavedAt={lastSavedAt}
          />
        </div>
      </div>
    </>
  )
}

function humanTimeFrom(iso?: string): string {
  if (!iso) return 'just now'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
