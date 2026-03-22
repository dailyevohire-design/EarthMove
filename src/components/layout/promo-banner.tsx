import { Truck, Phone } from 'lucide-react'

export function PromoBanner() {
  return (
    <div className="bg-gray-900 text-white">
      <div className="container-main">
        <div className="flex items-center justify-between py-2 text-xs">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck size={12} className="text-emerald-400" />
              Free delivery on orders over $500
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-gray-400">
              Same-day delivery available
            </span>
          </div>
          <a href="tel:8885553478" className="flex items-center gap-1.5 font-semibold hover:text-emerald-400 transition-colors">
            <Phone size={11} />
            (888) 555-DIRT
          </a>
        </div>
      </div>
    </div>
  )
}
