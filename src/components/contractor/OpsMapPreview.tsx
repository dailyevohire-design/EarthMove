'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

export type MapPin = {
  id: string
  lat: number
  lng: number
  kind: 'dispatch' | 'project'
  label?: string
}

type Props = {
  center: { lat: number; lng: number } | null
  zoom?: number
  pins?: MapPin[]
  height?: number
  footerStats?: Array<{ label: string; value: string }>
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function OpsMapPreview({ center, zoom = 10, pins = [], height = 420, footerStats }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || !center) return
    let map: any
    let cancelled = false
    ;(async () => {
      const maplibre = (await import('maplibre-gl')).default
      if (cancelled) return
      map = new maplibre.Map({
        container: containerRef.current!,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      map.on('load', () => {
        pins.forEach((p) => {
          const el = document.createElement('div')
          el.style.width = p.kind === 'dispatch' ? '14px' : '10px'
          el.style.height = el.style.width
          el.style.borderRadius = '50%'
          el.style.background = p.kind === 'dispatch' ? 'var(--safety-500)' : 'var(--earth-500)'
          el.style.border = '2px solid var(--bone-50)'
          el.style.boxShadow = '0 0 0 4px rgba(232,147,24,0.18)'
          new maplibre.Marker({ element: el })
            .setLngLat([p.lng, p.lat])
            .addTo(map)
        })
      })
    })()
    return () => {
      cancelled = true
      if (map) map.remove()
      mapRef.current = null
    }
  }, [center?.lat, center?.lng, zoom, pins])

  return (
    <div className="ec-map" style={{ height }}>
      {center ? (
        <div ref={containerRef} className="ec-map__canvas" />
      ) : (
        <div className="ec-map__empty">
          Set a default market on your profile to see live ops here.
        </div>
      )}
      {center && footerStats && footerStats.length > 0 && (
        <div className="ec-map__footer">
          {footerStats.map((s, i) => (
            <div key={i} className="ec-map__stat">
              <strong>{s.value}</strong> {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
