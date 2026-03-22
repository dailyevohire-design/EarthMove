import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Mountain, Waves, CircleDot, RouteOff, Gem, Hammer, Star, Layers } from 'lucide-react'

const CATEGORY_CONFIG: Record<string, {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
}> = {
  fill:      { icon: Mountain,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  iconColor: 'text-amber-500' },
  sand:      { icon: Waves,     bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200', iconColor: 'text-yellow-500' },
  gravel:    { icon: CircleDot, bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-300',   iconColor: 'text-gray-500' },
  aggregate: { icon: RouteOff,  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', iconColor: 'text-orange-500' },
  rock:      { icon: Gem,       bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   iconColor: 'text-blue-500' },
  recycled:  { icon: Hammer,    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',iconColor: 'text-emerald-500' },
  specialty: { icon: Star,      bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', iconColor: 'text-purple-500' },
}

const DEFAULT_CONFIG = { icon: Layers, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', iconColor: 'text-gray-500' }

export async function CategoryGrid() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('material_categories')
    .select('id, name, slug, icon_name')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
      {(data ?? []).map((cat: any) => {
        const config = CATEGORY_CONFIG[cat.slug] ?? DEFAULT_CONFIG
        const Icon = config.icon
        return (
          <Link
            key={cat.id}
            href={`/browse?category=${cat.slug}`}
            className={`flex-shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-2xl ${config.bg} border ${config.border} hover:shadow-md transition-all duration-200 group`}
          >
            <Icon size={18} className={`${config.iconColor} transition-colors`} />
            <span className={`text-sm font-semibold ${config.text} whitespace-nowrap`}>
              {cat.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
