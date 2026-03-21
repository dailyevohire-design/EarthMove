import type { OrderStatus } from '@/types'
import { Check, Truck, PackageCheck, XCircle, Clock } from 'lucide-react'

const STEPS = [
  { key: 'confirmed', label: 'Confirmed',   icon: Check },
  { key: 'dispatched', label: 'Dispatched', icon: Truck },
  { key: 'delivered', label: 'Delivered',   icon: PackageCheck },
] as const

const STEP_INDEX: Partial<Record<OrderStatus, number>> = {
  confirmed:  0,
  dispatched: 1,
  delivered:  2,
}

export function OrderStatusTimeline({ status }: { status: string }) {
  const isFailed = ['cancelled', 'payment_failed', 'refunded'].includes(status)
  const isPending = status === 'pending_payment'
  const currentIdx = STEP_INDEX[status as OrderStatus] ?? -1

  if (isPending) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <Clock size={17} className="text-amber-500" />
        <span className="text-sm">Awaiting payment confirmation…</span>
      </div>
    )
  }

  if (isFailed) {
    return (
      <div className="flex items-center gap-3 text-red-500">
        <XCircle size={17} />
        <span className="text-sm capitalize">{status.replace(/_/g, ' ')}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done    = currentIdx > i
        const current = currentIdx === i
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done    ? 'bg-emerald-600 border-emerald-600 text-white' :
                current ? 'bg-emerald-50 border-emerald-500 text-emerald-600' :
                          'bg-gray-100 border-gray-200 text-gray-400'
              }`}>
                <Icon size={15} />
              </div>
              <span className={`text-xs font-medium ${done || current ? 'text-gray-700' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${currentIdx > i ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
