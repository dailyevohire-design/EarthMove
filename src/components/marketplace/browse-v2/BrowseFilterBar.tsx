const SANS = "'Inter', -apple-system, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export interface BrowseFilterBarProps {
  categories: Array<{ slug: string; name: string; materialCount: number }>
  totalCount: number
}

// followup #31: scroll-tracked active state on filter bar (client-side)
export function BrowseFilterBar({ categories, totalCount }: BrowseFilterBarProps) {
  return (
    <nav
      aria-label="Category filter"
      className="sticky top-0 z-[4] mt-8 py-3.5 -mx-10 px-10"
      style={{ background: '#F1ECE2', borderBottom: '1px solid #D8D2C4' }}
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <FilterPill href="#cat-top" active label="All" count={totalCount} />
        {categories.map((c) => (
          <FilterPill
            key={c.slug}
            href={`#cat-${c.slug}`}
            label={c.name}
            count={c.materialCount}
          />
        ))}
      </div>
    </nav>
  )
}

function FilterPill({
  href,
  label,
  count,
  active = false,
}: {
  href: string
  label: string
  count: number
  active?: boolean
}) {
  const base = 'rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-2 transition-colors border'
  const palette = active
    ? 'bg-[#15201B] text-[#F1ECE2] border-[#15201B]'
    : 'bg-transparent text-[#2A332E] border-[#D8D2C4] hover:border-[#5C645F]'
  return (
    <a href={href} className={`${base} ${palette}`} style={{ fontFamily: SANS }}>
      {label}
      <span
        className={`text-[11px] font-semibold ${active ? 'text-[rgba(241,236,226,0.65)]' : 'text-[#5C645F]'}`}
        style={{ fontFamily: MONO }}
      >
        {count}
      </span>
    </a>
  )
}
