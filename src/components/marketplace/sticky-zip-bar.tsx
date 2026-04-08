'use client'

import { useEffect, useState } from 'react'
import { MapPin, ArrowUp } from 'lucide-react'

/**
 * Sticky reminder bar that appears after the user scrolls past the hero
 * without entering a ZIP. Clicking it smooth-scrolls to the hero ZIP picker.
 * Only rendered when no market is set (controlled by parent).
 */
export function StickyZipBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      // Show once the user is ~80% past a typical viewport
      setVisible(window.scrollY > window.innerHeight * 0.8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToZip = () => {
    const el = document.getElementById('hero-zip')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="bg-gray-900/95 backdrop-blur-md border-t border-emerald-500/30 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-bold truncate">
                Enter your ZIP to see prices & delivery
              </div>
              <div className="text-white/50 text-xs truncate hidden sm:block">
                Live local pricing unlocks instantly
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToZip}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/30 transition-colors flex-shrink-0"
          >
            Enter ZIP
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
