import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Mountain, Waves, CircleDot, RouteOff, Gem, Hammer, Star, Layers } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  mountain: Mountain, waves: Waves, 'circle-dot': CircleDot,
  road: RouteOff, gem: Gem, hammer: Hammer, star: Star, layers: Layers,
}

export async function CategoryGrid() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('material_categories')
    .select('id, name, slug, icon_name')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
      {(data ?? []).map((cat: any) => {
        const Icon = ICONS[cat.icon_name] ?? Mountain
        return (
          <Link
            key={cat.id}
            href={`/browse?category=${cat.slug}`}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 transition-all group"
          >
            <Icon size={17} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
            <span className="text-[11px] font-medium text-gray-500 group-hover:text-emerald-700 transition-colors whitespace-nowrap">
              {cat.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
