'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, MapPin, Truck, Star } from 'lucide-react'

function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const counted = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return { count, ref }
}

export function AnimatedStats() {
  const suppliers = useCountUp(7000, 2000)
  const cities = useCountUp(10, 1500)
  const tons = useCountUp(50000, 2500)
  const rating = useCountUp(49, 1800) // 4.9 * 10

  return (
    <section className="py-14 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div ref={suppliers.ref} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Users size={22} className="text-emerald-600" />
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tabular-nums">
              {suppliers.count.toLocaleString()}+
            </div>
            <div className="text-sm text-gray-500 font-medium mt-1">Supplier Partners</div>
          </div>
          <div ref={cities.ref} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <MapPin size={22} className="text-blue-600" />
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tabular-nums">
              {cities.count}
            </div>
            <div className="text-sm text-gray-500 font-medium mt-1">Cities Served</div>
          </div>
          <div ref={tons.ref} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Truck size={22} className="text-amber-600" />
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tabular-nums">
              {tons.count.toLocaleString()}+
            </div>
            <div className="text-sm text-gray-500 font-medium mt-1">Tons Delivered</div>
          </div>
          <div ref={rating.ref} className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <Star size={22} className="text-purple-600" />
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tabular-nums">
              {(rating.count / 10).toFixed(1)}★
            </div>
            <div className="text-sm text-gray-500 font-medium mt-1">Customer Rating</div>
          </div>
        </div>
      </div>
    </section>
  )
}
