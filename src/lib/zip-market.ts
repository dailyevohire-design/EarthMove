// src/lib/zip-market.ts
// Maps US zip code prefixes to EarthMove launch markets.
//
// Launch markets: Dallas-Fort Worth + Denver only.
// Coverage: roughly a 100-mile radius around each metro center.

interface ZipMarket {
  market_slug: string
  market_name: string
  /** 3-digit ZIP prefixes (numeric, 100-999) that resolve to this market */
  prefixes: number[]
}

function range(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

/**
 * The two launch markets. Keeping this list canonical here means we can
 * point any other "list of active markets" query at it instead of trusting
 * whatever rows happen to exist in the markets table.
 */
export const LAUNCH_MARKET_SLUGS = ['dallas-fort-worth', 'denver'] as const
export type LaunchMarketSlug = typeof LAUNCH_MARKET_SLUGS[number]

export const ALL_ZIP_MARKETS: ZipMarket[] = [
  {
    market_slug: 'dallas-fort-worth',
    market_name: 'Dallas-Fort Worth',
    // ~100mi radius around DFW. Covers Dallas, Fort Worth, Plano, Frisco,
    // McKinney, Arlington, Denton, Garland, Mesquite, Waxahachie, Sherman,
    // Greenville, Tyler, Waco, Wichita Falls, Mineral Wells, Stephenville.
    // Texas prefixes 750-758, 760-766, 768, 769.
    prefixes: [
      ...range(750, 758), // Dallas, Mesquite, Garland, Plano, McKinney, Greenville, Tyler, Palestine
      ...range(760, 766), // Fort Worth, Arlington, Denton, Wichita Falls, Waco, Killeen-Temple north
      768,                // Stephenville / Mineral Wells
      769,                // Abilene fringe (kept for inclusivity, ~150mi but contractors travel)
    ],
  },
  {
    market_slug: 'denver',
    market_name: 'Denver',
    // ~100mi radius around Denver. Covers Denver, Aurora, Lakewood, Boulder,
    // Longmont, Fort Collins, Greeley, Loveland, Castle Rock, Colorado Springs,
    // Pueblo (borderline). Colorado prefixes 800-810.
    prefixes: range(800, 810),
  },
]

// Build a fast lookup map: prefix (number) → ZipMarket
const prefixMap = new Map<number, ZipMarket>()
for (const market of ALL_ZIP_MARKETS) {
  for (const prefix of market.prefixes) {
    prefixMap.set(prefix, market)
  }
}

/**
 * Given a 5-digit US zip code, returns the matching EarthMove market
 * or null if the zip is outside all service areas.
 */
export function resolveMarketFromZip(
  zip: string
): { market_slug: string; market_name: string } | null {
  const cleaned = zip.replace(/\s/g, '')
  if (!/^\d{5}$/.test(cleaned)) return null

  const prefix = parseInt(cleaned.slice(0, 3), 10)
  const match = prefixMap.get(prefix)
  if (!match) return null

  return {
    market_slug: match.market_slug,
    market_name: match.market_name,
  }
}
