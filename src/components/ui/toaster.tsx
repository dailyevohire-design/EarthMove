'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

export interface ToastData {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// Simple global store — no external dependency needed
let _listeners: ((t: ToastData[]) => void)[] = []
let _toasts: ToastData[] = []

function notify() {
  _listeners.forEach(fn => fn([..._toasts]))
}

export function toast(message: string, type: ToastData['type'] = 'info', duration = 4000) {
  const id = Math.random().toString(36).slice(2, 9)
  _toasts = [..._toasts, { id, message, type }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }, duration)
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const handler = (t: ToastData[]) => setToasts(t)
    _listeners.push(handler)
    return () => { _listeners = _listeners.filter(l => l !== handler) }
  }, [])

  const dismiss = (id: string) => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info
        const cls = t.type === 'success'
          ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
          : t.type === 'error'
          ? 'bg-red-950 border-red-800 text-red-200'
          : 'bg-stone-900 border-stone-700 text-stone-200'

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl shadow-black/40 animate-fade-up pointer-events-auto ${cls}`}
          >
            <Icon size={16} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1 text-sm leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
