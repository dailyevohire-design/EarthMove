'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ChevronDown, Check } from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
  slug: string
}

export function CitySelector({ cities, currentCity }: { cities: City[]; currentCity: City }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCity = (city: City) => {
    document.cookie = `market_id=${city.id};path=/;max-age=${60 * 60 * 24 * 365}`
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20"
      >
        <MapPin size={14} className="text-emerald-400" />
        {currentCity.name}, {currentCity.state}
        <ChevronDown size={14} className={`text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivering to</p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {cities.map(city => (
              <button
                key={city.id}
                onClick={() => selectCity(city)}
                className={`flex items-center justify-between w-full px-4 py-3 text-sm transition-colors ${
                  city.id === currentCity.id
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MapPin size={13} className={city.id === currentCity.id ? 'text-emerald-500' : 'text-gray-300'} />
                  {city.name}, {city.state}
                </span>
                {city.id === currentCity.id && <Check size={14} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
