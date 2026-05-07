export type ProjectSlug = 'driveway' | 'drainage' | 'backfill' | 'garden' | 'concrete'
export type MarketSlug = 'denver' | 'dallas-fort-worth'
export type TruckClass = 'small' | 'standard' | 'tri-axle'

export interface ProjectIntent {
  slug: ProjectSlug
  name: string
  description: string
  tagChips: string[]
  materialSlugs: string[]
  typicalTons: { min: number; max: number }
  truckClasses: TruckClass[]
  availableMarkets: MarketSlug[]
}

export const PROJECTS: ProjectIntent[] = [
  {
    slug: 'driveway',
    name: 'Driveway base',
    description:
      'Best for new driveways, parking pads, and base under concrete or pavers. Compacts hard, holds under load.',
    tagChips: ['Class 5', '¾″ minus', 'Crushed'],
    materialSlugs: [
      'class-6',
      'abc-stone',
      'road-base',
      'recycled-concrete',
      'recycled-asphalt',
      'crushed-limestone',
      'flex-base',
    ],
    typicalTons: { min: 8, max: 15 },
    truckClasses: ['standard', 'tri-axle'],
    availableMarkets: ['denver', 'dallas-fort-worth'],
  },
  {
    slug: 'drainage',
    name: 'Drainage',
    description:
      "Used for French drains, foundation perimeter, and gravel beds. Clean, washed, free-draining — water moves through, soil doesn't.",
    tagChips: ['¾″ washed', 'Drain rock', 'Round'],
    materialSlugs: ['57-stone', 'drainage-rock', 'river-rock', 'washed-river-rock', 'pea-gravel'],
    typicalTons: { min: 3, max: 10 },
    truckClasses: ['small', 'standard'],
    availableMarkets: ['denver', 'dallas-fort-worth'],
  },
  {
    slug: 'backfill',
    name: 'Backfill & leveling',
    description:
      'Used to raise grade, backfill foundations, and close out holes. Screened, no debris, no clay clods.',
    tagChips: ['Screened', 'Clean fill', 'No debris'],
    materialSlugs: ['select-fill', 'structural-fill', 'fill-dirt', 'common-fill', 'embankment-fill'],
    typicalTons: { min: 15, max: 30 },
    truckClasses: ['standard', 'tri-axle'],
    availableMarkets: ['dallas-fort-worth'],
  },
  {
    slug: 'garden',
    name: 'Garden & landscaping',
    description:
      'Used for lawns, garden beds, and planting beds. Dark loam, screened to ½″ — what plants want.',
    tagChips: ['Screened', 'High organic', 'Planting mix'],
    materialSlugs: ['topsoil', 'screened-topsoil', 'garden-soil', 'garden-soil-mix', 'mulch', 'compost'],
    typicalTons: { min: 3, max: 8 },
    truckClasses: ['small', 'standard'],
    availableMarkets: ['dallas-fort-worth'],
  },
  {
    slug: 'concrete',
    name: 'Concrete & structural',
    description:
      'Used for concrete mix, paver base, and structural fill. Rounded, washed, ⅜″ aggregate that meets concrete spec.',
    tagChips: ['⅜″ rounded', 'Concrete sand', 'Pea gravel'],
    materialSlugs: ['concrete-sand', 'masonry-sand', 'pea-gravel', '57-stone', '67-stone'],
    typicalTons: { min: 5, max: 12 },
    truckClasses: ['standard', 'tri-axle'],
    availableMarkets: ['denver', 'dallas-fort-worth'],
  },
]

export function getProject(slug: string): ProjectIntent | null {
  return PROJECTS.find((p) => p.slug === slug) ?? null
}

export const PROJECT_SLUGS: ProjectSlug[] = PROJECTS.map((p) => p.slug)
