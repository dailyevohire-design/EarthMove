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
export const LAUNCH_MARKET_SLUGS = [
  'dallas-fort-worth', 'denver', 'phoenix', 'houston', 'atlanta',
  'orlando', 'tampa', 'las-vegas', 'raleigh', 'salt-lake-city',
  'austin', 'boise',
] as const
export type LaunchMarketSlug = typeof LAUNCH_MARKET_SLUGS[number]

export const ALL_ZIP_MARKETS: ZipMarket[] = [
  {
    market_slug: 'dallas-fort-worth',
    market_name: 'Dallas-Fort Worth',
    prefixes: [
      ...range(750, 758), // Dallas, Mesquite, Garland, Plano, McKinney
      ...range(760, 766), // Fort Worth, Arlington, Denton, Waco
      768, 769,
    ],
  },
  {
    market_slug: 'denver',
    market_name: 'Denver',
    prefixes: range(800, 810), // Denver, Aurora, Boulder, Fort Collins, Colorado Springs
  },
  {
    market_slug: 'phoenix',
    market_name: 'Phoenix',
    prefixes: [...range(850, 853), 855], // Phoenix, Mesa, Scottsdale, Tempe, Chandler, Gilbert
  },
  {
    market_slug: 'houston',
    market_name: 'Houston',
    prefixes: [...range(770, 775), 777], // Houston, Katy, Sugar Land, Woodlands, Galveston
  },
  {
    market_slug: 'atlanta',
    market_name: 'Atlanta',
    prefixes: [...range(300, 303), 311], // Atlanta, Marietta, Kennesaw, Decatur, Alpharetta
  },
  {
    market_slug: 'orlando',
    market_name: 'Orlando',
    prefixes: [...range(327, 329), 347], // Orlando, Kissimmee, Sanford, Daytona Beach
  },
  {
    market_slug: 'tampa',
    market_name: 'Tampa',
    prefixes: [...range(335, 337), 346], // Tampa, St Petersburg, Clearwater, Brandon, Lakeland
  },
  {
    market_slug: 'las-vegas',
    market_name: 'Las Vegas',
    prefixes: range(889, 891), // Las Vegas, Henderson, North Las Vegas, Boulder City
  },
  {
    market_slug: 'raleigh',
    market_name: 'Raleigh',
    prefixes: range(275, 277), // Raleigh, Durham, Chapel Hill, Cary, Wake Forest
  },
  {
    market_slug: 'salt-lake-city',
    market_name: 'Salt Lake City',
    prefixes: [840, 841, 843], // Salt Lake City, Ogden, Provo
  },
  {
    market_slug: 'austin',
    market_name: 'Austin',
    prefixes: [786, 787, 789], // Austin, Round Rock, Georgetown, San Marcos
  },
  {
    market_slug: 'boise',
    market_name: 'Boise',
    prefixes: [836, 837], // Boise, Meridian, Nampa, Caldwell
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
