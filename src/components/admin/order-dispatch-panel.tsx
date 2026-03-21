'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignDispatch, markEnRoute, markDelivered, markDispatchFailed } from '@/app/admin/orders/[id]/actions'
import { Loader2, Truck, CheckCircle2, XCircle, User } from 'lucide-react'

interface Props {
  order: { id: string; status: string; customer?: { first_name?: string; phone?: string } }
  dispatch: any | null
}

export function OrderDispatchPanel({ order, dispatch }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [driverName, setDriverName] = useState(dispatch?.driver_name ?? '')
  const [driverPhone, setDriverPhone] = useState(dispatch?.driver_phone ?? '')
  const [truckInfo, setTruckInfo] = useState(dispatch?.truck_info ?? '')
  const [opsNotes, setOpsNotes] = useState(dispatch?.ops_notes ?? '')
  const [failReason, setFailReason] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const dispatchStatus = dispatch?.status ?? 'queued'

  const act = (fn: () => Promise<void>) => {
    setFeedback(null)
    startTransition(async () => {
      try { await fn(); router.refresh() }
      catch (e: any) { setFeedback({ type: 'err', msg: e.message }) }
    })
  }

  const handleAssign = () => act(async () => {
    const r = await assignDispatch({
      orderId: order.id,
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      truckInfo: truckInfo || undefined,
      opsNotes: opsNotes || undefined,
    })
    if (!r.success) throw new Error(r.error)
    setFeedback({ type: 'ok', msg: 'Dispatched.' })
  })

  const handleEnRoute = () => act(async () => {
    const r = await markEnRoute(order.id)
    if (!r.success) throw new Error(r.error)
    setFeedback({ type: 'ok', msg: 'Marked en route.' })
  })

  const handleDelivered = () => act(async () => {
    const r = await markDelivered(order.id)
    if (!r.success) throw new Error(r.error)
    setFeedback({ type: 'ok', msg: 'Order delivered!' })
  })

  const handleFail = () => {
    if (!failReason.trim()) { setFeedback({ type: 'err', msg: 'Enter a reason.' }); return }
    act(async () => {
      const r = await markDispatchFailed(order.id, failReason)
      if (!r.success) throw new Error(r.error)
    })
  }

  return (
    <div className="card p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-stone-200 text-sm mb-1">Dispatch</h3>
        <p className="text-xs text-stone-500">
          Status: <span className="text-amber-400 font-medium capitalize">{dispatchStatus.replace(/_/g, ' ')}</span>
        </p>
      </div>

      {/* Driver fields */}
      {['queued', 'assigned'].includes(dispatchStatus) && (
        <div className="space-y-3">
          <div>
            <label className="input-label text-xs">Driver name</label>
            <input className="input text-sm" placeholder="John Driver" value={driverName} onChange={e => setDriverName(e.target.value)} />
          </div>
          <div>
            <label className="input-label text-xs">Driver phone</label>
            <input className="input text-sm" placeholder="(817) 555-0000" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} />
          </div>
          <div>
            <label className="input-label text-xs">Truck / trailer</label>
            <input className="input text-sm" placeholder="Ford F750, TX-4821" value={truckInfo} onChange={e => setTruckInfo(e.target.value)} />
          </div>
          <div>
            <label className="input-label text-xs">Ops notes</label>
            <textarea className="input text-sm resize-none" rows={2} placeholder="Any notes…" value={opsNotes} onChange={e => setOpsNotes(e.target.value)} />
          </div>
          <button onClick={handleAssign} disabled={pending} className="btn-primary btn-md w-full">
            {pending ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><Truck size={14} />Mark Dispatched</>}
          </button>
        </div>
      )}

      {dispatchStatus === 'assigned' && (
        <button onClick={handleEnRoute} disabled={pending} className="btn-secondary btn-md w-full">
          {pending ? <><Loader2 size={14} className="animate-spin" />…</> : <><Truck size={14} />Mark En Route</>}
        </button>
      )}

      {dispatchStatus === 'en_route' && (
        <button onClick={handleDelivered} disabled={pending} className="btn-primary btn-md w-full">
          {pending ? <><Loader2 size={14} className="animate-spin" />…</> : <><CheckCircle2 size={14} />Mark Delivered</>}
        </button>
      )}

      {dispatchStatus === 'delivered' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span className="text-emerald-400 text-sm font-medium">Delivered</span>
        </div>
      )}

      {/* Failure */}
      {!['delivered', 'failed'].includes(dispatchStatus) && dispatchStatus !== 'queued' && (
        <div className="space-y-2 pt-3 border-t border-stone-800">
          <label className="input-label text-xs text-red-400">Mark as failed</label>
          <input className="input text-sm" placeholder="Reason…" value={failReason} onChange={e => setFailReason(e.target.value)} />
          <button onClick={handleFail} disabled={pending} className="btn-danger btn-sm w-full">
            <XCircle size={13} /> Mark Failed
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-lg text-sm border ${
          feedback.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>{feedback.msg}</div>
      )}

      {/* Quick call */}
      {order.customer?.phone && (
        <div className="pt-3 border-t border-stone-800">
          <a href={`tel:${order.customer.phone}`} className="btn-secondary btn-sm w-full">
            <User size={13} /> Call {order.customer.first_name ?? 'Customer'}
          </a>
        </div>
      )}
    </div>
  )
}
