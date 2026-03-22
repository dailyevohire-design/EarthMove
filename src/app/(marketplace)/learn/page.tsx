import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Clock, ArrowRight, Sparkles, TrendingUp, Search } from 'lucide-react'

export const metadata = {
  title: 'Learn — Material Guides, Calculators & Expert Tips',
  description: 'Free guides on gravel driveways, fill dirt, drainage, material calculators, and more. Written by industry experts.',
}

const ARTICLES = [
  {
    slug: 'driveway-gravel-guide',
    title: 'The Complete Guide to Driveway Gravel in 2025',
    description: 'Everything you need to know about choosing, calculating, and installing the right driveway material.',
    image: 'https://images.unsplash.com/photo-1558618047-3c37c2d3b4b0?w=800&q=80&fit=crop',
    readTime: '12 min',
    category: 'Homeowner',
    featured: true,
    seasonal: false,
  },
  {
    slug: 'spring-project-guide-2025',
    title: '2025 Spring Project Guide: What to Order and When',
    description: 'Beat the price increases. Your seasonal planning guide for spring projects.',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&fit=crop',
    readTime: '9 min',
    category: 'Seasonal',
    featured: false,
    seasonal: true,
  },
  {
    slug: 'fill-dirt-vs-topsoil',
    title: 'Fill Dirt vs Topsoil: Which One Do You Actually Need?',
    description: 'The difference could save you thousands. Here\'s how to choose the right material.',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
    readTime: '8 min',
    category: 'Homeowner',
    featured: true,
    seasonal: false,
  },
  {
    slug: 'gravel-calculator',
    title: 'Free Gravel and Aggregate Calculator',
    description: 'Calculate cubic yards, tons, and truckloads for any project.',
    image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80',
    readTime: '2 min',
    category: 'Calculator',
    featured: true,
    seasonal: false,
  },
  {
    slug: 'french-drain-materials',
    title: 'Best Materials for French Drains and Drainage Projects',
    description: 'Stop water damage before it starts. Complete drainage materials guide.',
    image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80&fit=crop',
    readTime: '10 min',
    category: 'Homeowner',
    featured: false,
    seasonal: false,
  },
  {
    slug: 'how-much-gravel-do-i-need',
    title: 'How Much Gravel Do I Need? The Ultimate Calculator Guide',
    description: 'Never over-order or under-order again.',
    image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80',
    readTime: '6 min',
    category: 'Calculator',
    featured: false,
    seasonal: false,
  },
  {
    slug: 'material-grades-explained',
    title: 'Understanding Aggregate Grades: A Contractor\'s Guide',
    description: '#57 stone, #67 stone, Grade 1 flex base — what do these numbers mean?',
    image: 'https://images.unsplash.com/photo-1568283096533-078a24bde253?w=800&q=80&fit=crop',
    readTime: '7 min',
    category: 'Contractor',
    featured: false,
    seasonal: false,
  },
  {
    slug: 'ordering-wrong-material',
    title: 'The $3,000 Mistake: What Happens When You Order the Wrong Material',
    description: 'Real stories of costly material mistakes — and how to avoid them.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&fit=crop',
    readTime: '8 min',
    category: 'Homeowner',
    featured: false,
    seasonal: false,
  },
]

const CATEGORIES = ['All', 'Homeowner', 'Contractor', 'Calculator', 'Seasonal']

export default function LearnPage() {
  const seasonal = ARTICLES.find(a => a.seasonal)
  const featured = ARTICLES.filter(a => a.featured)
  const rest = ARTICLES.filter(a => !a.seasonal)

  return (
    <div className="bg-gray-50/30 min-h-screen">
      {/* Hero */}
      <section className="bg-gray-900 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-4">
            <BookOpen size={16} />
            Knowledge Center
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight max-w-3xl">
            Learn before you order.
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl text-lg">
            Free guides, calculators, and expert tips from the team at EarthMove. Everything you need to get your project right the first time.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Seasonal pick */}
        {seasonal && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-600">Seasonal Pick</span>
            </div>
            <Link href={`/learn/${seasonal.slug}`} className="group block">
              <div className="relative rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[3/1]">
                <Image src={seasonal.image} alt={seasonal.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                <div className="absolute inset-0 flex items-center p-8 md:p-12">
                  <div className="max-w-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">Spring 2025</span>
                      <span className="text-white/60 text-xs">{seasonal.readTime}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-snug mb-3">{seasonal.title}</h2>
                    <p className="text-white/70 text-sm hidden md:block">{seasonal.description}</p>
                    <span className="inline-flex items-center gap-1 mt-4 text-emerald-400 font-semibold text-sm group-hover:text-emerald-300 transition-colors">
                      Read guide <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Category filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat, i) => (
            <span
              key={cat}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold cursor-default ${
                i === 0 ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Most Popular */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Most Popular This Week</span>
          </div>
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map(article => (
            <Link key={article.slug} href={`/learn/${article.slug}`} className="group block">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image src={article.image} alt={article.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-bold text-gray-700">{article.category}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 leading-snug group-hover:text-emerald-600 transition-colors mb-2">{article.title}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2">{article.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} /> {article.readTime}</span>
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">Read <ArrowRight size={12} /></span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter signup */}
        <div className="mt-16 bg-gray-900 rounded-2xl p-8 md:p-12 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-2">Get the seasonal materials guide</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">Free quarterly guide with project ideas, pricing trends, and pro tips delivered to your inbox.</p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input type="email" placeholder="Enter your email" className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button className="btn-primary px-6 py-3 text-sm">Subscribe</button>
          </div>
        </div>
      </div>
    </div>
  )
}
