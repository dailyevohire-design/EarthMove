'use client'

import { useState } from 'react'
import { Phone, X, Mail, MessageCircle } from 'lucide-react'

export function SupportWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-16 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-fade-up">
          <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-sm">Need Help?</div>
              <div className="text-emerald-200 text-xs">We&apos;re here Mon–Sat 6am–6pm</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <a
              href="tel:+18885553478"
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Phone size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">(888) 555-DIRT</div>
                <div className="text-xs text-gray-500">Call us now</div>
              </div>
            </a>

            <a
              href="mailto:support@earthmove.io"
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Email Support</div>
                <div className="text-xs text-gray-500">support@earthmove.io</div>
              </div>
            </a>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
          open
            ? 'bg-gray-800 hover:bg-gray-700'
            : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-110'
        }`}
        aria-label="Contact support"
      >
        {open ? (
          <X size={20} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
      </button>
    </div>
  )
}

// Keep old export name for backwards compat during transition
export { SupportWidget as ChatWidget }
