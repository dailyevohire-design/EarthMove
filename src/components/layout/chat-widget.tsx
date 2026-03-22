'use client'

import { useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

export function ChatWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-fade-up">
          {/* Header */}
          <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-sm">EarthMove Support</div>
              <div className="text-emerald-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                We typically reply in minutes
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 h-52 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <MessageCircle size={20} className="text-emerald-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">Need help with your order?</p>
            <p className="text-gray-400 text-xs">Call us at <span className="font-semibold text-gray-600">(888) 555-DIRT</span> or send us a message below.</p>
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 text-sm px-4 py-2.5 rounded-xl bg-gray-100 border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
              />
              <button className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white hover:bg-emerald-700 transition-colors shadow-sm">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
          open
            ? 'bg-gray-800 hover:bg-gray-700 rotate-0'
            : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-110'
        }`}
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
