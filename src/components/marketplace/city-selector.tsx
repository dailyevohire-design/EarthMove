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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200"
      >
        <MapPin size={13} />
        {currentCity.name}, {currentCity.state}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select your market</p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {cities.map(city => (
              <button
                key={city.id}
                onClick={() => selectCity(city)}
                className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-colors ${
                  city.id === currentCity.id
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{city.name}, {city.state}</span>
                {city.id === currentCity.id && <Check size={14} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
