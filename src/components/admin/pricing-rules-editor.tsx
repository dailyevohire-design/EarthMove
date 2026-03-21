'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePricingRule } from '@/app/admin/pricing/actions'
import { Loader2 } from 'lucide-react'

interface Rule { id: string; rule_type: string; config: any; market?: { name: string } | null; market_id: string | null }

export function PricingRulesEditor({
  rules,
  markets,
}: {
  rules: Rule[]
  markets: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const handleSave = (rule: Rule, newConfig: Record<string, unknown>) => {
    setFeedback(f => ({ ...f, [rule.id]: { ok: false, msg: '' } }))
    startTransition(async () => {
      const result = await savePricingRule(rule.id, newConfig)
      setFeedback(f => ({
        ...f,
        [rule.id]: result.success ? { ok: true, msg: 'Saved.' } : { ok: false, msg: result.error },
      }))
      if (result.success) router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {rules.map(rule => (
        <RuleCard key={rule.id} rule={rule} pending={pending} feedback={feedback[rule.id]} onSave={handleSave} />
      ))}
      {rules.length === 0 && (
        <div className="card p-8 text-center text-stone-600 text-sm">
          No pricing rules found. Run the schema migration to seed defaults.
        </div>
      )}
    </div>
  )
}

function RuleCard({
  rule, pending, feedback, onSave,
}: {
  rule: Rule
  pending: boolean
  feedback?: { ok: boolean; msg: string }
  onSave: (rule: Rule, config: Record<string, unknown>) => void
}) {
  const [config, setConfig] = useState(rule.config ?? {})

  const updateConfig = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value
      setConfig((c: any) => ({ ...c, [key]: val }))
    }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-200 capitalize">{rule.rule_type.replace(/_/g, ' ')}</h3>
          <p className="text-stone-500 text-xs mt-0.5">{rule.market?.name ?? 'All markets'}</p>
        </div>
      </div>

      {rule.rule_type === 'platform_fee' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label text-xs">Fee %</label>
            <input
              type="number" step="0.1" min="0" max="50" className="input text-sm"
              value={(config as any).value ?? 9}
              onChange={updateConfig('value')}
            />
            <p className="text-xs text-stone-600 mt-1">Applied to subtotal + delivery fee</p>
          </div>
        </div>
      )}

      {rule.rule_type === 'delivery_tier' && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="input-label text-xs">Base fee ($)</label>
            <input type="number" step="0.01" min="0" className="input text-sm" value={(config as any).base_fee ?? 95} onChange={updateConfig('base_fee')} />
          </div>
          <div>
            <label className="input-label text-xs">Free miles</label>
            <input type="number" step="1" min="0" className="input text-sm" value={(config as any).free_miles ?? 10} onChange={updateConfig('free_miles')} />
          </div>
          <div>
            <label className="input-label text-xs">Per mile ($)</label>
            <input type="number" step="0.01" min="0" className="input text-sm" value={(config as any).per_mile ?? 3.50} onChange={updateConfig('per_mile')} />
          </div>
        </div>
      )}

      {rule.rule_type === 'min_order_value' && (
        <div>
          <label className="input-label text-xs">Minimum order ($)</label>
          <input type="number" step="0.01" min="0" className="input text-sm w-40" value={(config as any).amount ?? 100} onChange={updateConfig('amount')} />
        </div>
      )}

      {feedback?.msg && (
        <div className={`p-2 rounded-lg text-xs ${feedback.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {feedback.msg}
        </div>
      )}

      <button
        onClick={() => onSave(rule, config)}
        disabled={pending}
        className="btn-primary btn-sm"
      >
        {pending ? <><Loader2 size={12} className="animate-spin" />Saving…</> : 'Save Rule'}
      </button>
    </div>
  )
}
