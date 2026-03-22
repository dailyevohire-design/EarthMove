// src/lib/zip-market.ts
// Maps US zip code prefixes to EarthMove markets.

interface ZipMarket {
  market_slug: string
  market_name: string
  prefixes: number[]
}

function range(start: number, end: number): number[] {
  const result: number[] = []
  for (let i = start; i <= end; i++) result.push(i)
  return result
}

export const ALL_ZIP_MARKETS: ZipMarket[] = [
  {
    market_slug: 'dallas-fort-worth',
    market_name: 'Dallas-Fort Worth',
    prefixes: [...range(750, 753), ...range(760, 763), 756],
  },
  {
    market_slug: 'houston',
    market_name: 'Houston',
    prefixes: [...range(770, 775), 777],
  },
  {
    market_slug: 'austin',
    market_name: 'Austin',
    prefixes: [...range(786, 789), 785],
  },
  {
    market_slug: 'san-antonio',
    market_name: 'San Antonio',
    prefixes: [...range(780, 782), 783],
  },
  {
    market_slug: 'phoenix',
    market_name: 'Phoenix',
    prefixes: [...range(850, 853), 855, 856, 857],
  },
  {
    market_slug: 'denver',
    market_name: 'Denver',
    prefixes: [...range(800, 804), 805, 806, 808],
  },
  {
    market_slug: 'atlanta',
    market_name: 'Atlanta',
    prefixes: [...range(300, 303), 304, 305, 306, 311, 312],
  },
  {
    market_slug: 'nashville',
    market_name: 'Nashville',
    prefixes: [...range(370, 372), 373, 374],
  },
  {
    market_slug: 'charlotte',
    market_name: 'Charlotte',
    prefixes: [...range(280, 282), 283, 284],
  },
  {
    market_slug: 'tampa',
    market_name: 'Tampa',
    prefixes: [...range(335, 337), 338, 346, 347],
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
