'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COLORADO_COUNTIES, TEXAS_DFW_COUNTIES } from '@/lib/collections/county-assessors'
import { UPL_DISCLAIMER } from '@/lib/collections/disclaimer'
import { BrokerScreenOut } from '@/components/collections/BrokerScreenOut'
import { StaffingScreenOut } from '@/components/collections/StaffingScreenOut'
import { UncertainRoleWarning } from '@/components/collections/UncertainRoleWarning'

type State = 'CO' | 'TX'
type PropType = 'commercial' | 'residential_non_homestead' | 'residential_homestead' | 'mixed_use' | 'industrial' | 'other'
type Role =
  | 'original_contractor' | 'subcontractor' | 'sub_subcontractor' | 'material_supplier' | 'other'
  | 'hired_by_broker' | 'hired_by_staffing' | 'not_construction_work'

const SCREENING_OPTIONS: { value: Role; label: string }[] = [
  { value: 'original_contractor',  label: 'The property owner directly' },
  { value: 'subcontractor',        label: 'A general contractor' },
  { value: 'sub_subcontractor',    label: 'Another subcontractor' },
  { value: 'material_supplier',    label: 'I supplied materials or hauled material delivered to the project' },
  { value: 'hired_by_broker',      label: 'A broker, dispatch, or middleman company' },
  { value: 'hired_by_staffing',    label: 'A staffing agency or payroll company' },
  { value: 'not_construction_work',label: "The work wasn't on real property (off-site repair, mobile work)" },
  { value: 'other',                label: 'Other / not sure' },
]
type EntityType = 'individual' | 'llc' | 'corporation' | 'partnership' | 'sole_proprietor' | 'other'

interface DraftState {
  state_code: State
  property_type: PropType
  is_homestead: boolean
  tx_contract_signed: 'yes_both' | 'yes_owner_only' | 'no' | ''
  original_contract_signed_date: string
  contractor_role: Role
  claimant_name: string
  claimant_address: string
  claimant_phone: string
  claimant_email: string
  claimant_entity_type: EntityType | ''
  respondent_name: string
  respondent_address: string
  respondent_relationship: string
  property_street_address: string
  property_city: string
  property_state: State
  property_zip: string
  property_county: string
  property_legal_description: string
  property_owner_name: string
  property_owner_address: string
  work_description: string
  first_day_of_work: string
  last_day_of_work: string
  amount_owed_dollars: string
  terms_accepted: boolean
}

const EMPTY_DRAFT: DraftState = {
  state_code: 'CO', property_type: 'commercial', is_homestead: false,
  tx_contract_signed: '', original_contract_signed_date: '',
  contractor_role: 'original_contractor',
  claimant_name: '', claimant_address: '', claimant_phone: '', claimant_email: '',
  claimant_entity_type: '',
  respondent_name: '', respondent_address: '', respondent_relationship: '',
  property_street_address: '', property_city: '', property_state: 'CO',
  property_zip: '', property_county: '', property_legal_description: '',
  property_owner_name: '', property_owner_address: '',
  work_description: '', first_day_of_work: '', last_day_of_work: '',
  amount_owed_dollars: '',
  terms_accepted: false,
}

const DRAFT_KEY = 'collections_draft_v2'

export default function NewCollectionsCasePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [d, setD] = useState<DraftState>(EMPTY_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DRAFT_KEY) : null
      if (raw) setD({ ...EMPTY_DRAFT, ...(JSON.parse(raw) as DraftState) })
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* ignore */ }
  }, [d])

  const update = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setD(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'state_code') next.property_state = v as State
      return next
    })

  const counties = d.state_code === 'CO' ? COLORADO_COUNTIES : TEXAS_DFW_COUNTIES

  // Live prediction of kit_variant — mirrors resolveKitVariant in validation.ts.
  const predictedKit = useMemo<'full_kit' | 'demand_only'>(() => {
    if (d.contractor_role === 'not_construction_work') return 'demand_only'
    if (d.state_code === 'TX' && d.is_homestead === true && d.tx_contract_signed !== 'yes_both') {
      return 'demand_only'
    }
    return 'full_kit'
  }, [d.state_code, d.is_homestead, d.tx_contract_signed, d.contractor_role])

  const deadlineWarning = useMemo(() => {
    if (!d.last_day_of_work) return null
    const last = new Date(d.last_day_of_work + 'T00:00:00Z')
    if (isNaN(last.getTime())) return null
    const fourMonthsAgo = new Date()
    fourMonthsAgo.setUTCMonth(fourMonthsAgo.getUTCMonth() - 4)
    if (last < fourMonthsAgo) {
      return d.state_code === 'CO'
        ? "Colorado mechanic's liens must be filed within 4 months of the last day of work per C.R.S. § 38-22-109(5). This claim may be past the filing deadline."
        : 'Texas lien filing deadlines may have passed for your tier. Consult an attorney before relying on the lien documents in this kit.'
    }
    return null
  }, [d.last_day_of_work, d.state_code])

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setServerError(null)
    setWarnings([])
    try {
      const original_contract_both_spouses_signed = d.tx_contract_signed === 'yes_both' ? true : d.tx_contract_signed === '' ? null : false

      const res = await fetch('/api/collections/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: d.state_code,
          contractor_role: d.contractor_role,
          property_type: d.property_type,
          is_homestead: d.is_homestead,
          claimant_name: d.claimant_name,
          claimant_address: d.claimant_address,
          claimant_phone: d.claimant_phone || null,
          claimant_email: d.claimant_email || null,
          claimant_entity_type: d.claimant_entity_type || null,
          respondent_name: d.respondent_name,
          respondent_address: d.respondent_address,
          respondent_relationship: d.respondent_relationship || null,
          property_street_address: d.property_street_address,
          property_city: d.property_city,
          property_state: d.property_state,
          property_zip: d.property_zip,
          property_county: d.property_county,
          property_legal_description: d.property_legal_description || null,
          property_owner_name: d.property_owner_name || null,
          property_owner_address: d.property_owner_address || null,
          original_contract_signed_date: d.original_contract_signed_date || null,
          original_contract_both_spouses_signed,
          work_description: d.work_description,
          first_day_of_work: d.first_day_of_work,
          last_day_of_work: d.last_day_of_work,
          amount_owed_cents: Math.round(parseFloat(d.amount_owed_dollars || '0') * 100),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(body?.message ?? body?.error ?? `Error ${res.status}`)
        return
      }
      if (Array.isArray(body.warnings) && body.warnings.length > 0) setWarnings(body.warnings)
      try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      if (body.checkout_url) window.location.assign(body.checkout_url)
      else router.push(`/collections/${body.case_id}`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <h1 className="text-2xl font-extrabold text-stone-900 mb-2">New Contractor Payment Kit Case</h1>
      <p className="text-xs text-stone-500 mb-5">Step {step} of 6</p>

      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${(step / 6) * 100}%` }} />
      </div>

      {d.contractor_role === 'other' && step > 1 && <UncertainRoleWarning />}

      {step === 1 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Who hired you for this job?</h2>
          <p className="text-xs text-stone-500">
            Mechanic&rsquo;s liens require a contractual or material-supply relationship to a real property project. This question screens whether the Contractor Payment Kit is the right tool — we can&rsquo;t help with broker payments, wage claims, or non-construction work.
          </p>

          <div className="space-y-2">
            {SCREENING_OPTIONS.map(o => (
              <label
                key={o.value}
                className={`block rounded-lg border p-3 cursor-pointer transition-colors ${
                  d.contractor_role === o.value
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="contractor_role"
                  value={o.value}
                  checked={d.contractor_role === o.value}
                  onChange={() => update('contractor_role', o.value)}
                  className="mr-2"
                />
                <span className="text-sm text-stone-900">{o.label}</span>
              </label>
            ))}
          </div>

          {d.contractor_role === 'hired_by_broker' && <BrokerScreenOut />}
          {d.contractor_role === 'hired_by_staffing' && <StaffingScreenOut />}

          {d.contractor_role === 'not_construction_work' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-bold mb-1">Demand-only kit</div>
              <p>Your case will use the demand-only variant — instruction packet + demand letter, no lien forms (the lien path requires a real property nexus, which off-site or mobile work doesn&rsquo;t establish).</p>
            </div>
          )}

          {d.contractor_role !== 'hired_by_broker' && d.contractor_role !== 'hired_by_staffing' && (
            <NavButtons onBack={null} onNext={() => setStep(2)} nextDisabled={!d.contractor_role} />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">State, Property Type, and Pre-Work Contract</h2>

          <L label="Property state">
            <select value={d.state_code} onChange={e => update('state_code', e.target.value as State)} className={selectCls}>
              <option value="CO">Colorado (CO)</option>
              <option value="TX">Texas (TX)</option>
            </select>
          </L>

          <L label="Property type">
            <select value={d.property_type} onChange={e => update('property_type', e.target.value as PropType)} className={selectCls}>
              <option value="commercial">Commercial</option>
              <option value="industrial">Industrial</option>
              <option value="residential_non_homestead">Residential (not a homestead)</option>
              <option value="residential_homestead">Residential (homestead)</option>
              <option value="mixed_use">Mixed use</option>
              <option value="other">Other</option>
            </select>
          </L>

          {d.property_type.startsWith('residential') && (
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={d.is_homestead} onChange={e => update('is_homestead', e.target.checked)} />
              This property is the owner&rsquo;s homestead.
            </label>
          )}

          {d.state_code === 'TX' && d.is_homestead && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
              <div className="font-bold">Texas homestead — pre-work contract question</div>
              <p>Texas lien law requires a pre-work written contract signed by both spouses for a homestead-improvement lien. Your answer here determines whether your kit includes the lien documents or is demand-only.</p>
              <L label="Did you sign a written contract with the property owner BEFORE starting work?">
                <select
                  value={d.tx_contract_signed}
                  onChange={e => update('tx_contract_signed', e.target.value as DraftState['tx_contract_signed'])}
                  className={selectCls}
                >
                  <option value="">Choose one…</option>
                  <option value="yes_both">Yes, signed by BOTH spouses before work began.</option>
                  <option value="yes_owner_only">Yes, but signed by one spouse only.</option>
                  <option value="no">No written contract (or signed after work began).</option>
                </select>
              </L>
              {d.tx_contract_signed === 'yes_both' && (
                <L label="Date the contract was signed">
                  <input type="date" value={d.original_contract_signed_date} onChange={e => update('original_contract_signed_date', e.target.value)} className={inputCls} />
                </L>
              )}
              {(d.tx_contract_signed === 'yes_owner_only' || d.tx_contract_signed === 'no') && (
                <p className="text-amber-900"><strong>Your case will use the demand-only variant.</strong> You will receive the instruction packet and a demand letter. No lien documents, because filing a lien on a Texas homestead without a pre-work spouse-signed contract exposes you to liability under Tex. Prop. Code § 53.156.</p>
              )}
            </div>
          )}

          {d.state_code === 'TX' &&
            (d.contractor_role === 'subcontractor' ||
             d.contractor_role === 'sub_subcontractor' ||
             d.contractor_role === 'material_supplier') && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-bold mb-1">Texas pre-lien notice warning</div>
              Texas subcontractors and suppliers must send monthly pre-lien notices per Tex. Prop. Code § 53.056. Your lien rights depend on whether those notices were sent on time. Your instruction packet walks through this in Step 1.
            </div>
          )}

          <div className={`rounded-lg border p-3 text-xs ${predictedKit === 'full_kit' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
            <div className="font-bold mb-1">Based on your answers, your kit will be:</div>
            {predictedKit === 'full_kit'
              ? <div>FULL KIT — 4 documents: instruction packet + demand letter + pre-lien/intent notice + lien.</div>
              : <div>DEMAND-ONLY — 2 documents: instruction packet (with an explanation of your case) + demand letter.</div>}
          </div>

          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)}
            nextDisabled={d.state_code === 'TX' && d.is_homestead && d.tx_contract_signed === ''} />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Claimant (You / Your Company)</h2>
          <L label="Name (or company name)">
            <input value={d.claimant_name} onChange={e => update('claimant_name', e.target.value)} className={inputCls} />
          </L>
          <L label="Address">
            <textarea value={d.claimant_address} onChange={e => update('claimant_address', e.target.value)} className={textareaCls} rows={3} />
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Phone">
              <input value={d.claimant_phone} onChange={e => update('claimant_phone', e.target.value)} className={inputCls} />
            </L>
            <L label="Email">
              <input type="email" value={d.claimant_email} onChange={e => update('claimant_email', e.target.value)} className={inputCls} />
            </L>
          </div>
          <L label="Entity type">
            <select value={d.claimant_entity_type} onChange={e => update('claimant_entity_type', e.target.value as EntityType | '')} className={selectCls}>
              <option value="">Choose one…</option>
              <option value="individual">Individual</option>
              <option value="llc">LLC</option>
              <option value="corporation">Corporation</option>
              <option value="partnership">Partnership</option>
              <option value="sole_proprietor">Sole proprietor</option>
              <option value="other">Other</option>
            </select>
          </L>
          <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)}
            nextDisabled={!d.claimant_name.trim() || d.claimant_address.length < 5} />
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Respondent & Property</h2>
          <L label="Respondent name (who owes the money)">
            <input value={d.respondent_name} onChange={e => update('respondent_name', e.target.value)} className={inputCls} />
          </L>
          <L label="Respondent address">
            <textarea value={d.respondent_address} onChange={e => update('respondent_address', e.target.value)} className={textareaCls} rows={3} />
          </L>
          <L label="Respondent&rsquo;s relationship to the project">
            <select value={d.respondent_relationship} onChange={e => update('respondent_relationship', e.target.value)} className={selectCls}>
              <option value="">Choose one…</option>
              <option value="general_contractor">General contractor</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="property_owner">Property owner</option>
              <option value="developer">Developer</option>
              <option value="other">Other</option>
            </select>
          </L>

          <hr className="my-4" />

          <L label="Property street address">
            <input value={d.property_street_address} onChange={e => update('property_street_address', e.target.value)} className={inputCls} />
          </L>
          <div className="grid grid-cols-3 gap-3">
            <L label="City"><input value={d.property_city} onChange={e => update('property_city', e.target.value)} className={inputCls} /></L>
            <L label="State"><input value={d.property_state} readOnly className={inputCls + ' bg-stone-100'} /></L>
            <L label="ZIP"><input value={d.property_zip} onChange={e => update('property_zip', e.target.value)} className={inputCls} /></L>
          </div>
          <L label="County">
            <select value={d.property_county} onChange={e => update('property_county', e.target.value)} className={selectCls}>
              <option value="">Choose a county…</option>
              {counties.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}</option>)}
            </select>
          </L>
          <L label="Legal description"
             hint="From your deed or title insurance policy. Leave blank only if unavailable — the instruction packet explains how to find it.">
            <textarea value={d.property_legal_description} onChange={e => update('property_legal_description', e.target.value)} className={textareaCls} rows={3} />
          </L>

          <hr className="my-4" />

          <L label="Property owner name">
            <input value={d.property_owner_name} onChange={e => update('property_owner_name', e.target.value)} className={inputCls} />
          </L>
          <L label="Property owner address">
            <textarea value={d.property_owner_address} onChange={e => update('property_owner_address', e.target.value)} className={textareaCls} rows={3} />
          </L>
          <button
            type="button"
            onClick={async () => {
              if (!d.property_county) { alert('Choose a county first.'); return }
              const res = await fetch(`/api/collections/property-helper?state=${d.state_code}&county=${encodeURIComponent(d.property_county)}`)
              const body = await res.json().catch(() => ({}))
              if (body?.url) { window.open(body.url, '_blank'); alert('Look up owner name and address, then return here to continue.') }
              else alert(body?.fallback_query ?? 'No portal available for this county.')
            }}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
          >
            Not sure who owns this?
          </button>

          <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)}
            nextDisabled={!d.respondent_name.trim() || !d.property_street_address.trim() || !d.property_county} />
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Claim</h2>
          <L label="What work was done? (min 50 characters)">
            <textarea value={d.work_description} onChange={e => update('work_description', e.target.value)} className={textareaCls} rows={4} />
            <div className="text-[10px] text-stone-500 mt-1">{d.work_description.length} / 50+</div>
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="First day of work"><input type="date" value={d.first_day_of_work} onChange={e => update('first_day_of_work', e.target.value)} className={inputCls} /></L>
            <L label="Last day of work"><input type="date" value={d.last_day_of_work} onChange={e => update('last_day_of_work', e.target.value)} className={inputCls} /></L>
          </div>
          <L label="Amount owed ($)">
            <input type="number" step="0.01" min="0" value={d.amount_owed_dollars} onChange={e => update('amount_owed_dollars', e.target.value)} className={inputCls} />
          </L>
          {deadlineWarning && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">{deadlineWarning}</div>
          )}
          <NavButtons
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
            nextDisabled={
              d.work_description.length < 50 ||
              !d.first_day_of_work || !d.last_day_of_work ||
              !d.amount_owed_dollars || parseFloat(d.amount_owed_dollars) <= 0
            }
          />
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Review & Submit</h2>

          <div className={`rounded-lg border p-3 text-sm font-semibold ${predictedKit === 'full_kit' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
            Kit you will receive: <span className="font-extrabold">{predictedKit === 'full_kit' ? 'FULL KIT (4 documents)' : 'DEMAND-ONLY (2 documents)'}</span>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs text-stone-700 space-y-1">
            <Row k="State"    v={d.state_code} />
            <Row k="Property" v={`${d.property_type}${d.is_homestead ? ' (homestead)' : ''}`} />
            <Row k="Role"     v={d.contractor_role} />
            <Row k="Claimant" v={d.claimant_name} />
            <Row k="Respondent" v={d.respondent_name} />
            <Row k="Property address" v={`${d.property_street_address}, ${d.property_city}, ${d.property_state} ${d.property_zip}`} />
            <Row k="County" v={d.property_county} />
            <Row k="Work dates" v={`${d.first_day_of_work} → ${d.last_day_of_work}`} />
            <Row k="Amount owed" v={`$${d.amount_owed_dollars}`} />
          </div>

          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="font-bold mb-1">Acknowledgment required</div>
            <p>{UPL_DISCLAIMER}</p>
            <label className="mt-3 flex items-start gap-2 text-amber-900">
              <input
                type="checkbox"
                checked={d.terms_accepted}
                onChange={e => update('terms_accepted', e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand I am purchasing a document kit with plain-English instructions, not a legal service. I will read the instruction packet, verify statutory language against the public statute at the URLs provided, notarize where required, and file the documents myself. I accept full responsibility for accuracy and timing.
              </span>
            </label>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}
          {serverError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">{serverError}</div>
          )}

          <NavButtons
            onBack={() => setStep(5)}
            onNext={submit}
            nextLabel={submitting ? 'Submitting…' : 'Pay $49 and generate documents'}
            nextDisabled={!d.terms_accepted || submitting}
          />
        </section>
      )}
    </div>
  )
}

const inputCls    = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
const textareaCls = inputCls
const selectCls   = inputCls + ' pr-8'

function L(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-stone-700 block mb-1">{props.label}</span>
      {props.children}
      {props.hint && <span className="block text-[11px] text-stone-500 mt-1">{props.hint}</span>}
    </label>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-36 text-stone-500">{k}</span>
      <span className="text-stone-900 font-medium">{v || '—'}</span>
    </div>
  )
}

function NavButtons(props: { onBack: (() => void) | null; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-stone-100">
      {props.onBack
        ? <button onClick={props.onBack} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900">← Back</button>
        : <div />}
      <button
        onClick={props.onNext}
        disabled={props.nextDisabled}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-sm"
      >
        {props.nextLabel ?? 'Next →'}
      </button>
    </div>
  )
}
