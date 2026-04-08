import { MapPin, Package, Truck, Lock, Shield, Clock, Users } from 'lucide-react'

const STEPS = [
  {
    icon: MapPin,
    title: 'Enter your ZIP',
    body: 'We instantly check which of our 7,000+ supplier yards serve your job site.',
  },
  {
    icon: Package,
    title: 'Pick your materials',
    body: 'Live pricing on gravel, fill dirt, sand, topsoil, and road base — no phone tag.',
  },
  {
    icon: Truck,
    title: 'We deliver same-day',
    body: 'Order in under 5 minutes. Trucks roll to your site as soon as today.',
  },
]

const SAMPLE_MATERIALS = [
  { name: 'Fill Dirt', category: 'Dirt & Fill', unit: 'per ton' },
  { name: 'Crushed Gravel', category: 'Aggregate', unit: 'per ton' },
  { name: 'Screened Topsoil', category: 'Soil & Mulch', unit: 'per yd³' },
  { name: 'Flex Base', category: 'Road Base', unit: 'per ton' },
]

/**
 * Shown to visitors who have NOT entered a ZIP yet. Replaces the pre-ZIP
 * dead zone with real value: how-it-works, trust strip, and a blurred
 * preview of materials that teases the user into entering their ZIP.
 */
export function PreZipPitch() {
  return (
    <>
      {/* How it works */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">
              How it works
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              Materials delivered in three steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <div
                  key={s.title}
                  className="group relative p-7 rounded-2xl bg-white border-2 border-emerald-500/40 transition-all duration-300 will-change-transform hover:-translate-y-1 hover:border-emerald-500/80 touch-manipulation"
                  style={{
                    boxShadow:
                      '0 0 0 1px rgba(16,185,129,0.15), 0 0 32px rgba(16,185,129,0.22), 0 0 80px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.95), 0 12px 28px -16px rgba(15,23,42,0.18)',
                  }}
                >
                  {/* Inner gradient wash */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-2xl pointer-events-none opacity-80"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0) 45%, rgba(16,185,129,0.04) 100%)',
                    }}
                  />
                  {/* Glowing step number */}
                  <div
                    className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-emerald-500 text-white text-sm font-black flex items-center justify-center z-10"
                    style={{
                      boxShadow:
                        '0 0 0 4px rgba(16,185,129,0.15), 0 0 24px rgba(16,185,129,0.6), 0 8px 16px -4px rgba(16,185,129,0.4)',
                    }}
                  >
                    {i + 1}
                  </div>
                  {/* Glowing icon tile */}
                  <div
                    className="relative w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4"
                    style={{
                      boxShadow:
                        '0 0 20px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.6)',
                    }}
                  >
                    <Icon size={24} className="text-emerald-600" />
                  </div>
                  <h3 className="relative text-lg font-extrabold text-gray-900 mb-2">{s.title}</h3>
                  <p className="relative text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-10 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <TrustStat icon={Users} value="7,000+" label="Supplier yards" />
            <TrustStat icon={Truck} value="Same-day" label="Delivery windows" />
            <TrustStat icon={Shield} value="Secure" label="Card checkout" />
            <TrustStat icon={Clock} value="< 5 min" label="To order" />
          </div>
        </div>
      </section>

      {/* Blurred sample materials — the tease */}
      <section className="py-16 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
              Popular materials in your area
            </h2>
            <p className="text-gray-500">
              Enter your ZIP above to unlock live pricing and delivery windows.
            </p>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {SAMPLE_MATERIALS.map((m) => (
                <div
                  key={m.name}
                  className="rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-gray-200 to-gray-300 relative">
                    <div className="absolute inset-0 opacity-40" style={{
                      backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(16,185,129,0.3), transparent 60%), radial-gradient(circle at 70% 60%, rgba(245,158,11,0.2), transparent 60%)'
                    }} />
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{m.category}</div>
                    <div className="text-lg font-extrabold text-gray-900 mb-2">{m.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-20 rounded bg-gray-200 blur-[4px] select-none" aria-hidden>
                        $00.00
                      </div>
                      <span className="text-xs text-gray-400">{m.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Unlock overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <a
                href="#hero-zip"
                className="pointer-events-auto inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-gray-900 text-white font-extrabold shadow-2xl hover:bg-black transition-colors"
              >
                <Lock size={18} className="text-emerald-400" />
                Enter ZIP to unlock pricing
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function TrustStat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <Icon size={20} className="text-emerald-600 mb-2" />
      <div className="text-xl md:text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}
