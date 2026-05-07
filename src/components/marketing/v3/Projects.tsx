import Link from 'next/link'
import type { Project } from '@/lib/projects'

const ICONS: Record<string, string> = {
  'pea-gravel': 'M2 14h16M2 10h12M5 14V10M9 14V10M13 14V10',
  'landscape-rock': 'M3 16l3-4 3 2 3-5 3 4 2-2v5H3z M7 8a2 2 0 100-4 2 2 0 000 4z',
  'paver-base': 'M2 14h16M3 14V8l7-3 7 3v6M7 14V10h6v4',
  'base-stone': 'M3 16h14V8L10 4 3 8z M3 16V8 M17 16V8 M10 4v12',
  'concrete-aggregate': 'M3 8h14v8H3z M3 12h14M7 8v8M11 8v8',
}

const fallbackIcon = 'M3 16h14M5 16V8h10v8'

export function Projects({ projects }: { projects: Project[] }) {
  return (
    <section className="v3-projects">
      {projects.map((p, i) => (
        <Link key={p.slug} href={`/projects/${p.slug}`} className="v3-project">
          <span className="ph">{String(i + 1).padStart(2, '0')}</span>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path
              d={ICONS[p.slug] ?? fallbackIcon}
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="pl">{p.name}</div>
          <div className="ps">~{p.typicalTons.min}–{p.typicalTons.max}t · {p.audience}</div>
        </Link>
      ))}
    </section>
  )
}
