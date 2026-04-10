import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const BASE = 'https://earthmove.io'

// Fallback static lists used only if Supabase is unreachable at build time.
// The dynamic query below is the source of truth when the DB is available.
const FALLBACK_CITIES = ['dallas', 'houston', 'austin', 'phoenix', 'denver', 'atlanta', 'tampa', 'orlando', 'las-vegas', 'raleigh', 'salt-lake-city', 'boise']
const FALLBACK_MATERIALS = ['fill-dirt', 'select-fill', 'topsoil', 'concrete-sand', 'pea-gravel', 'flex-base', 'road-base', 'washed-river-rock', 'limestone', 'crushed-concrete', 'decomposed-granite', 'base-gravel-57', 'rip-rap', 'masonry-sand', 'utility-sand']

const ARTICLES = ['driveway-gravel-guide', 'fill-dirt-vs-topsoil', 'french-drain-materials', 'how-much-gravel-do-i-need', 'spring-project-guide-2025', 'gravel-calculator', 'material-grades-explained', 'ordering-wrong-material']

async function getDynamicSlugs(): Promise<{ cities: string[]; materials: string[] }> {
  try {
    const supabase = await createClient()
    const [marketsRes, materialsRes] = await Promise.all([
      supabase.from('markets').select('slug').eq('is_active', true),
      supabase.from('material_catalog').select('slug').eq('is_active', true),
    ])
    const cities = (marketsRes.data ?? []).map((m: any) => m.slug).filter(Boolean)
    const materials = (materialsRes.data ?? []).map((m: any) => m.slug).filter(Boolean)
    return {
      cities: cities.length > 0 ? cities : FALLBACK_CITIES,
      materials: materials.length > 0 ? materials : FALLBACK_MATERIALS,
    }
  } catch {
    return { cities: FALLBACK_CITIES, materials: FALLBACK_MATERIALS }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { cities, materials } = await getDynamicSlugs()
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/deals`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/material-match`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/learn`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const materialPages: MetadataRoute.Sitemap = materials.map(slug => ({
    url: `${BASE}/browse/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const cityPages: MetadataRoute.Sitemap = cities.map(city => ({
    url: `${BASE}/${city}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const locationPages: MetadataRoute.Sitemap = cities.flatMap(city =>
    materials.map(material => ({
      url: `${BASE}/${city}/${material}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  )

  const learnPages: MetadataRoute.Sitemap = ARTICLES.map(slug => ({
    url: `${BASE}/learn/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...staticPages, ...materialPages, ...cityPages, ...locationPages, ...learnPages]
}
