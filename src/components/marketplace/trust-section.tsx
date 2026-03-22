import { Truck, MapPin, Clock, Star, Users, ShieldCheck } from 'lucide-react'

export function TrustStats() {
  return (
    <section className="py-12 bg-white border-y border-gray-100">
      <div className="container-main">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {[
            { value: '7,000+', label: 'Supplier Partners', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
            { value: '10', label: 'Cities Served', icon: MapPin, color: 'text-blue-600 bg-blue-50' },
            { value: '<5 min', label: 'Average Order Time', icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { value: '4.9★', label: 'Customer Rating', icon: Star, color: 'text-purple-600 bg-purple-50' },
          ].map(({ value, label, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mx-auto mb-3`}>
                <Icon size={20} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 font-medium mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CustomerReviews() {
  const reviews = [
    {
      name: 'Marcus Johnson',
      city: 'Dallas, TX',
      rating: 5,
      project: 'Driveway',
      text: 'Ordered 28 tons of flex base for my driveway project. Delivered same day, driver was professional and placed it exactly where I needed. Way easier than calling around to yards.',
      date: '2 weeks ago',
    },
    {
      name: 'Sarah Chen',
      city: 'Houston, TX',
      rating: 5,
      project: 'Landscaping',
      text: 'Used EarthMove for topsoil and pea gravel for our backyard renovation. The quantity calculator saved me from over-ordering. Price was better than the local landscape supply.',
      date: '1 month ago',
    },
    {
      name: 'David Williams',
      city: 'Phoenix, AZ',
      rating: 5,
      project: 'Pool Backfill',
      text: 'Needed 40 tons of fill dirt for a pool backfill on a tight timeline. Had it delivered next morning. The online ordering process is a game-changer for contractors like me.',
      date: '3 weeks ago',
    },
  ]

  return (
    <section className="py-14 md:py-20 bg-gray-50">
      <div className="container-main">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Reviews</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">Trusted by contractors and homeowners</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">Join thousands of professionals who order materials through EarthMove.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {reviews.map((review, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">"{review.text}"</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{review.name}</div>
                  <div className="text-gray-400 text-xs">{review.city} · {review.project}</div>
                </div>
                <span className="text-gray-400 text-xs">{review.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function WhyEarthMove() {
  return (
    <section className="py-14 md:py-20 bg-white">
      <div className="container-main">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Why EarthMove</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-2">Better than calling suppliers directly</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              title: 'Transparent pricing',
              body: 'See exact prices per ton or cubic yard before you order. No surprise fees, no haggling, no "call for pricing" games. What you see is what you pay.',
              icon: ShieldCheck,
            },
            {
              title: 'Order from anywhere',
              body: 'No more driving to yards, waiting in line, or playing phone tag. Order from your phone at the job site, from the office, or from your couch at midnight.',
              icon: Clock,
            },
            {
              title: 'Reliable delivery',
              body: 'We vet every supplier in our network. Track your delivery in real-time. If something goes wrong, our team handles it — you never chase a driver.',
              icon: Truck,
            },
          ].map(({ title, body, icon: Icon }) => (
            <div key={title} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <Icon size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-3">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
