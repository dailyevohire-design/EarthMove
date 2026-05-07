import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type ProjectCard = {
  slug: string;
  num: string;
  title: string;
  blurb: string;
  tags: string[];
  tonnage: string;
  truck: string;
};

const HOMEOWNER_PROJECTS: ProjectCard[] = [
  {
    slug: 'pea-gravel',
    num: '01',
    title: 'Paths, patios & play areas',
    blurb:
      'Pea gravel for backyard walkways, fire-pit sitting areas, dog runs, and light drainage. Smooth underfoot, rakes flat, no power tools.',
    tags: ['Pea gravel', '⅜″ rounded', 'Decorative'],
    tonnage: 'Typical 3–8 tons',
    truck: 'Fits small / standard',
  },
  {
    slug: 'landscape-rock',
    num: '02',
    title: 'Beds, borders & accents',
    blurb:
      'Decorative river and egg rock for flower beds, foundation accent bands, fence-line weed control, and rock mulch replacement.',
    tags: ['River rock', '1″–2″', 'Egg rock'],
    tonnage: 'Typical 2–6 tons',
    truck: 'Fits small / standard',
  },
  {
    slug: 'paver-base',
    num: '03',
    title: 'Paver patios & small driveways',
    blurb:
      'ABC and ¾″ crushed base under pavers, segmental retaining walls, and small concrete slabs. Compacts hard, holds under load.',
    tags: ['Class 5', '¾″ minus', 'Crushed'],
    tonnage: 'Typical 8–15 tons',
    truck: 'Fits standard / tri-axle',
  },
];

const CONTRACTOR_PROJECTS: ProjectCard[] = [
  {
    slug: 'base-stone',
    num: '04',
    title: 'Roads, drives, parking & slabs',
    blurb:
      'Crusher run, #3/#4/#5, and ABC for road base, subdivision streets, commercial parking lots, and subbase under large concrete slabs.',
    tags: ['ABC', 'Crusher run', '#3 / #4 / #5'],
    tonnage: 'Typical 30–200+ tons',
    truck: 'Tri-axle / belly dump',
  },
  {
    slug: 'concrete-aggregate',
    num: '05',
    title: 'Foundations & flatwork',
    blurb:
      'Washed concrete sand and #67/#89 aggregate for ready-mix, footings, foundations, sidewalks, curbs, and structural concrete.',
    tags: ['Concrete sand', '#67 / #89', 'Washed'],
    tonnage: 'Typical 20–150+ tons',
    truck: 'Standard / tri-axle',
  },
];

function ProjectCardItem({ p }: { p: ProjectCard }) {
  return (
    <Link
      href={`/order?project=${p.slug}`}
      className="group relative flex flex-col rounded-2xl bg-white border border-stone-200/80 p-7 transition-all duration-200 hover:border-[#1F3D2E]/30 hover:shadow-[0_8px_30px_-12px_rgba(31,61,46,0.18)]"
    >
      <div className="flex items-baseline justify-between mb-5">
        <span className="text-4xl font-light text-stone-300 tracking-tight tabular-nums">
          {p.num}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
          {p.tonnage}
        </span>
      </div>

      <h3 className="text-2xl font-semibold text-[#1F3D2E] tracking-tight leading-tight mb-3">
        {p.title}
      </h3>

      <p className="text-stone-600 leading-relaxed mb-5 flex-grow">{p.blurb}</p>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {p.tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-medium"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-stone-100">
        <span className="text-xs text-stone-500">{p.truck}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F3D2E] transition-all group-hover:gap-2.5">
          See materials
          <ArrowRight className="w-4 h-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function MaterialsSection() {
  return (
    <section className="bg-[#FAF7F2] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#1F3D2E]/70 mb-4">
            Materials
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.05] tracking-tight mb-5">
            Tell us what you&rsquo;re building.
            <br />
            We bring what builds it.
          </h2>
          <p className="text-lg text-stone-600 leading-relaxed">
            Five project families. Every truck class. Every verified yard in your market.
            Name the outcome &mdash; driveway, footing, drain, fill, finish &mdash; we match
            the material, route the truck, and lock the price against the closest yard.
          </p>
        </div>

        <div className="mb-16">
          <div className="flex items-baseline justify-between mb-8 pb-4 border-b border-stone-200">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1F3D2E]">
              For homeowners
            </h3>
            <span className="text-xs text-stone-500 hidden sm:inline">
              Most-ordered residential projects
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOMEOWNER_PROJECTS.map((p) => (
              <ProjectCardItem key={p.slug} p={p} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-8 pb-4 border-b border-stone-200">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1F3D2E]">
              For contractors
            </h3>
            <span className="text-xs text-stone-500 hidden sm:inline">
              High-volume site &amp; paving work
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {CONTRACTOR_PROJECTS.map((p) => (
              <ProjectCardItem key={p.slug} p={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default MaterialsSection;
