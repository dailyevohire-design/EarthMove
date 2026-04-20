'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search } from 'lucide-react'
import { resolveMarketFromZip } from '@/lib/zip-market'

interface City {
  id: string
  name: string
  state: string
  slug: string
}

export function LocationModal({ cities }: { cities: City[] }) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState('')

  useEffect(() => {
    const hasLocation = localStorage.getItem('earthmove_market_id')
    if (!hasLocation) setShow(true)
  }, [])

  const selectCity = (city: City) => {
    localStorage.setItem('earthmove_market_id', city.id)
    localStorage.setItem('earthmove_market_name', city.name)
    localStorage.setItem('earthmove_market_state', city.state)
    document.cookie = `market_id=${city.id};path=/;max-age=${60 * 60 * 24 * 365}`
    setShow(false)
    router.refresh()
  }

  const handleZip = () => {
    setZipError('')
    if (zip.length !== 5) { setZipError('Enter a 5-digit ZIP code'); return }
    const match = resolveMarketFromZip(zip)
    if (match) {
      const city = cities.find(c => c.slug === match.market_slug)
      if (city) { selectCity(city); return }
    }
    setZipError(`We're not in your area yet. We're expanding fast — check back soon!`)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-up">
        {/* Header */}
        <div className="p-8 pb-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <MapPin size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Where are we delivering?</h2>
          <p className="text-gray-500 mt-2">Select your city or enter your ZIP code</p>
        </div>

        {/* ZIP entry */}
        <div className="px-8 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                maxLength={5}
                placeholder="Enter ZIP code"
                value={zip}
                onChange={e => { setZip(e.target.value.replace(/\D/g, '')); setZipError('') }}
                onKeyDown={e => e.key === 'Enter' && handleZip()}
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium"
              />
            </div>
            <button onClick={handleZip} className="btn-primary px-6 py-3.5 text-sm">
              Go
            </button>
          </div>
          {zipError && (
            <p className="text-sm text-red-500 mt-2 px-1">{zipError}</p>
          )}
        </div>

        <div className="px-8 py-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">or select your city</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* City grid */}
        <div className="p-8 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => selectCity(city)}
              className="group flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                <MapPin size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{city.name}</div>
                <div className="text-gray-400 text-xs">{city.state}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Header location indicator */
export function LocationIndicator() {
  const [city, setCity] = useState<{ name: string; state: string } | null>(null)

  useEffect(() => {
    const name = localStorage.getItem('earthmove_market_name')
    const state = localStorage.getItem('earthmove_market_state')
    if (name && state) setCity({ name, state })
  }, [])

  const clearLocation = () => {
    localStorage.removeItem('earthmove_market_id')
    localStorage.removeItem('earthmove_market_name')
    localStorage.removeItem('earthmove_market_state')
    document.cookie = 'market_id=;path=/;max-age=0'
    window.location.reload()
  }

  if (!city) return null

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <MapPin size={14} className="text-emerald-500" />
      <span className="font-medium text-gray-700">{city.name}, {city.state}</span>
      <button
        onClick={clearLocation}
        className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold ml-1 transition-colors"
      >
        Change
      </button>
    </div>
  )
}

/** Persistent location banner */
export function LocationBanner() {
  const [city, setCity] = useState<{ name: string; state: string } | null>(null)

  useEffect(() => {
    const name = localStorage.getItem('earthmove_market_name')
    const state = localStorage.getItem('earthmove_market_state')
    if (name && state) setCity({ name, state })
  }, [])

  const clearLocation = () => {
    localStorage.removeItem('earthmove_market_id')
    localStorage.removeItem('earthmove_market_name')
    localStorage.removeItem('earthmove_market_state')
    document.cookie = 'market_id=;path=/;max-age=0'
    window.location.reload()
  }

  if (!city) return null

  return (
    <div className="bg-emerald-50 border-b border-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-emerald-700">
          <MapPin size={12} />
          Delivering to {city.name}, {city.state}
          <span className="text-emerald-500">·</span>
          <button onClick={clearLocation} className="underline hover:no-underline transition-all">
            Change location
          </button>
        </div>
      </div>
    </div>
  )
}
