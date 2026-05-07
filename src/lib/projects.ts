export type Project = {
  slug: string
  name: string
  description: string
  typicalTons: { min: number; max: number }
  truckClasses: string[]
  audience: 'homeowner' | 'contractor'
}

export const PROJECTS: Project[] = [
  {
    slug: 'pea-gravel',
    name: 'Paths, patios & play areas',
    description:
      'Pea gravel for backyard walkways, fire-pit sitting areas, dog runs, and light drainage. Smooth underfoot, rakes flat, no power tools.',
    typicalTons: { min: 3, max: 8 },
    truckClasses: ['small', 'standard'],
    audience: 'homeowner',
  },
  {
    slug: 'landscape-rock',
    name: 'Beds, borders & accents',
    description:
      'Decorative river and egg rock for flower beds, foundation accent bands, fence-line weed control, and rock mulch replacement.',
    typicalTons: { min: 2, max: 6 },
    truckClasses: ['small', 'standard'],
    audience: 'homeowner',
  },
  {
    slug: 'paver-base',
    name: 'Paver patios & small driveways',
    description:
      'ABC and ¾″ crushed base under pavers, segmental retaining walls, and small concrete slabs. Compacts hard, holds under load.',
    typicalTons: { min: 8, max: 15 },
    truckClasses: ['standard', 'tri-axle'],
    audience: 'homeowner',
  },
  {
    slug: 'base-stone',
    name: 'Roads, drives, parking & slabs',
    description:
      'Crusher run, #3/#4/#5, and ABC for road base, subdivision streets, commercial parking lots, and subbase under large concrete slabs.',
    typicalTons: { min: 30, max: 200 },
    truckClasses: ['tri-axle', 'belly dump'],
    audience: 'contractor',
  },
  {
    slug: 'concrete-aggregate',
    name: 'Foundations & flatwork',
    description:
      'Washed concrete sand and #67/#89 aggregate for ready-mix, footings, foundations, sidewalks, curbs, and structural concrete.',
    typicalTons: { min: 20, max: 150 },
    truckClasses: ['standard', 'tri-axle'],
    audience: 'contractor',
  },
]

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug)
}
