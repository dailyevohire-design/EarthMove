/**
 * earthmove.io /learn — single source of truth for article inventory.
 * Both /learn (hub) and /learn/[slug] (PDP) consume this file.
 *
 * Schema notes:
 * - `slug` is the canonical URL segment.
 * - `legacySlugs` lists prior slugs that 301 to this canonical one (SEO continuity).
 * - `isStub: true` means the article body is not yet written — PDP renders StubArticleBody.
 * - `isHero: true` is the single article rendered in the hub's left-60% featured slot.
 *   Exactly one article should have `isHero: true`.
 * - `isFeatured: true` (without isHero) renders as a secondary featured card on the hub.
 *   Two articles should have `isFeatured: true && !isHero`.
 */

export type Category = 'homeowner' | 'contractor' | 'calculator';

export interface Article {
  slug: string;
  title: string;
  description: string;
  readTime: number; // minutes
  category: Category;
  isFeatured?: boolean;
  isHero?: boolean;
  isStub?: boolean;
  updatedAt: string; // ISO date YYYY-MM-DD
  legacySlugs?: string[];
}

export const ARTICLES: Article[] = [
  // === HOMEOWNER (12) ===
  {
    slug: 'driveway-gravel-complete-guide-2026',
    title: 'The Complete Guide to Driveway Gravel in 2026',
    description: 'Everything about choosing, calculating, and installing driveway materials.',
    readTime: 12,
    category: 'homeowner',
    isFeatured: true,
    isHero: true,
    updatedAt: '2026-04-26',
  },
  {
    slug: 'fill-dirt-vs-topsoil',
    title: 'Fill Dirt vs Topsoil: Which One Do You Actually Need?',
    description: 'The difference could save you thousands on your next project.',
    readTime: 8,
    category: 'homeowner',
    isFeatured: true,
    updatedAt: '2026-04-26',
  },
  {
    slug: 'best-materials-french-drains',
    title: 'Best Materials for French Drains',
    description: 'Stop water damage before it starts. Complete drainage guide.',
    readTime: 10,
    category: 'homeowner',
    isFeatured: true,
    updatedAt: '2026-04-22',
    legacySlugs: ['french-drain-materials'],
  },
  {
    slug: 'raising-low-spots-fill-dirt-howto',
    title: 'Raising Low Spots in Your Yard: A Fill-Dirt How-To',
    description: 'A weekend project for ½ to 2 yards of fill, with the prep, compaction, and seeding steps the pros take that homeowners usually skip.',
    readTime: 9,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-26',
  },
  {
    slug: 'decomposed-granite-patios-walkways',
    title: 'Decomposed Granite for Patios and Walkways',
    description: 'DG looks great and packs hard, but only if you screen, edge, and stabilize correctly. Here\'s what to specify.',
    readTime: 7,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-23',
  },
  {
    slug: 'pea-gravel-landscaping-sizing-depth-edging',
    title: 'Pea Gravel for Landscaping: Sizing, Depth, and Edging',
    description: 'The most-misused material in residential landscaping — sized, edged, and laid the way it actually stays put.',
    readTime: 6,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-25',
  },
  {
    slug: 'river-rock-vs-crushed-stone-drainage',
    title: 'River Rock vs Crushed Stone for Drainage',
    description: 'They look similar, drain very differently. When to pay extra for river rock and when crushed stone wins.',
    readTime: 8,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-24',
  },
  {
    slug: 'topsoil-new-lawns-depth-amendments',
    title: 'Topsoil for New Lawns: Depth, Amendments, Calculations',
    description: 'How much you actually need, what to amend it with, and the screened-vs-unscreened decision that determines if seed takes.',
    readTime: 9,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-21',
  },
  {
    slug: 'gravel-shed-playset-bases',
    title: 'Gravel for Shed and Playset Bases',
    description: 'A 4" pad of #57 stone over geotextile beats poured concrete for most backyard structures. The why.',
    readTime: 5,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-20',
  },
  {
    slug: 'riprap-erosion-control-residential',
    title: 'Riprap for Erosion Control on Residential Slopes',
    description: 'When the back yard washes out every storm, riprap is the answer — but the class matters more than the size.',
    readTime: 7,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-18',
  },
  {
    slug: 'mulch-alternatives-gravel-stone-dg',
    title: 'Mulch Alternatives: Gravel, Stone, DG Comparison',
    description: 'Mulch decomposes every year. These three alternatives don\'t — and the cost-per-decade math is brutal.',
    readTime: 6,
    category: 'homeowner',
    isStub: true,
    updatedAt: '2026-04-15',
  },
  {
    slug: 'three-thousand-dollar-mistake',
    title: 'The $3,000 Mistake: Real Stories of Costly Material Errors',
    description: 'Real stories of costly material mistakes and how to avoid them.',
    readTime: 8,
    category: 'homeowner',
    updatedAt: '2026-04-13',
    legacySlugs: ['ordering-wrong-material'],
  },

  // === CONTRACTOR (10) ===
  {
    slug: 'aggregate-grades-explained-57-67-flex-base',
    title: 'Aggregate Grades Explained: #57, #67, Grade 1 Flex Base',
    description: 'A field reference for crew leads — what each grade compacts to, what it drains, and where it gets specified.',
    readTime: 7,
    category: 'contractor',
    updatedAt: '2026-04-25',
    legacySlugs: ['material-grades-explained'],
  },
  {
    slug: 'road-base-specs-tx-co-dot',
    title: 'Road Base Specs by State DOT: TX vs CO',
    description: 'TxDOT Item 247 vs CDOT Class 6 — the spec differences that matter when you bid across state lines.',
    readTime: 11,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-22',
  },
  {
    slug: 'recycled-concrete-aggregate-inspector-approval',
    title: 'Recycled Concrete Aggregate: When Inspectors Approve It',
    description: 'RCA is 20-40% cheaper than virgin and increasingly required for green spec — but only if your gradation is right.',
    readTime: 9,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-19',
  },
  {
    slug: 'compaction-standards-proctor-density',
    title: 'Compaction Standards: Proctor Density and How to Hit It',
    description: '95% Standard Proctor sounds simple. The lift thickness, moisture window, and pass count that actually get you there.',
    readTime: 12,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-21',
  },
  {
    slug: 'subgrade-prep-parking-lots',
    title: 'Subgrade Prep for Parking Lots',
    description: 'The undocumented sequence that prevents callbacks: proof-roll, undercut, geotextile, base, surface.',
    readTime: 10,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-17',
  },
  {
    slug: 'drainage-stone-retention-ponds',
    title: 'Drainage Stone Selection for Retention Ponds',
    description: 'Pond bottoms, side slopes, outlet structures — three different stones, three different specs.',
    readTime: 8,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-16',
  },
  {
    slug: 'riprap-classes-d50-fdot-txdot',
    title: 'Riprap Classes: D50, Gradation, FDOT vs TxDOT',
    description: 'The class system explained, with side-by-side TxDOT and FDOT spec callouts for cross-state work.',
    readTime: 11,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-14',
  },
  {
    slug: 'concrete-sand-vs-mason-sand',
    title: 'Concrete Sand vs Mason Sand: Spec Compliance',
    description: 'ASTM C33 vs C144 — which one your inspector actually wants and how to source it without the upcharge.',
    readTime: 7,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-12',
  },
  {
    slug: 'trench-backfill-pipe-bedding-final-cover',
    title: 'Trench Backfill Specs: Pipe Bedding to Final Cover',
    description: 'Bedding stone, haunching, initial cover, final cover — the four-layer system and which materials each layer requires.',
    readTime: 10,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-10',
  },
  {
    slug: 'lime-rock-shell-rock-florida-spec',
    title: 'Lime Rock and Shell Rock: Florida Spec Guide',
    description: 'FDOT Section 911 vs 913 — the two materials that dominate Florida earthwork and where each one is the right call.',
    readTime: 9,
    category: 'contractor',
    isStub: true,
    updatedAt: '2026-04-08',
  },

  // === CALCULATORS (3) ===
  {
    slug: 'cubic-yards-calculator',
    title: 'Cubic Yards Calculator',
    description: 'Length × width × depth, with unit conversion. The fastest way to size your order before you call.',
    readTime: 2,
    category: 'calculator',
    updatedAt: '2026-04-26',
    legacySlugs: ['gravel-calculator', 'how-much-gravel-do-i-need'],
  },
  {
    slug: 'tonnage-estimator-by-density',
    title: 'Tonnage Estimator by Material Density',
    description: 'Cubic yards to tons for every common aggregate, with the density coefficient explained.',
    readTime: 3,
    category: 'calculator',
    isStub: true,
    updatedAt: '2026-04-24',
  },
  {
    slug: 'driveway-gravel-cost-estimator',
    title: 'Driveway Gravel Cost Estimator',
    description: 'Real-time cost estimate based on your driveway size and ZIP code — pricing pulls from verified suppliers in your market.',
    readTime: 4,
    category: 'calculator',
    isStub: true,
    updatedAt: '2026-04-23',
  },
];

/**
 * Slugs that no longer have a successor article.
 * Hit /learn/[slug] for any of these → 301 to /learn hub.
 */
export const LEGACY_HUB_REDIRECTS: string[] = [
  'spring-project-guide-2025',
];

// === Helpers ===

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/**
 * Returns the canonical successor for a legacy slug, or undefined if no successor.
 * Caller decides redirect target: undefined means check LEGACY_HUB_REDIRECTS or 404.
 */
export function getSuccessorForLegacySlug(legacySlug: string): Article | undefined {
  return ARTICLES.find((a) => a.legacySlugs?.includes(legacySlug));
}

export function getArticlesByCategory(category: Category): Article[] {
  return ARTICLES.filter((a) => a.category === category);
}

export function getHeroArticle(): Article {
  const hero = ARTICLES.find((a) => a.isHero);
  if (!hero) throw new Error('No hero article in registry — exactly one article must have isHero: true');
  return hero;
}

export function getSecondaryFeaturedArticles(): Article[] {
  return ARTICLES.filter((a) => a.isFeatured && !a.isHero);
}

export function getCategoryCounts(): Record<Category, number> {
  return {
    homeowner: ARTICLES.filter((a) => a.category === 'homeowner').length,
    contractor: ARTICLES.filter((a) => a.category === 'contractor').length,
    calculator: ARTICLES.filter((a) => a.category === 'calculator').length,
  };
}

// Sanity invariants — fail fast at module load time if registry is malformed.
if (ARTICLES.filter((a) => a.isHero).length !== 1) {
  throw new Error(`learn/articles.ts: exactly one article must have isHero: true (found ${ARTICLES.filter((a) => a.isHero).length})`);
}
if (ARTICLES.filter((a) => a.isFeatured && !a.isHero).length !== 2) {
  throw new Error(`learn/articles.ts: exactly two articles must be isFeatured (and not isHero) for the secondary featured slots (found ${ARTICLES.filter((a) => a.isFeatured && !a.isHero).length})`);
}
const slugs = ARTICLES.map((a) => a.slug);
if (new Set(slugs).size !== slugs.length) {
  throw new Error('learn/articles.ts: duplicate slugs in registry');
}
const allLegacy = ARTICLES.flatMap((a) => a.legacySlugs ?? []);
if (new Set(allLegacy).size !== allLegacy.length) {
  throw new Error('learn/articles.ts: duplicate legacy slugs across articles');
}
const legacyConflict = allLegacy.find((s) => slugs.includes(s));
if (legacyConflict) {
  throw new Error(`learn/articles.ts: legacy slug "${legacyConflict}" conflicts with an active slug`);
}
