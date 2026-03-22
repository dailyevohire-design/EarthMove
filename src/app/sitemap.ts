import type { MetadataRoute } from 'next'

const CITIES = ['dallas', 'houston', 'austin', 'san-antonio', 'phoenix', 'denver', 'atlanta', 'nashville', 'charlotte', 'tampa']
const MATERIALS = ['fill-dirt', 'select-fill', 'topsoil', 'concrete-sand', 'pea-gravel', 'flex-base', 'road-base', 'washed-river-rock', 'limestone', 'crushed-concrete', 'decomposed-granite', 'base-gravel-57', 'rip-rap', 'masonry-sand', 'utility-sand']
const ARTICLES = ['driveway-gravel-guide', 'fill-dirt-vs-topsoil', 'french-drain-materials', 'how-much-gravel-do-i-need', 'spring-project-guide-2025', 'gravel-calculator', 'material-grades-explained', 'ordering-wrong-material']

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://earthmove.io'

  const staticPages = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${base}/browse`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/deals`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/material-match`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${base}/learn`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
  ]

  const materialPages = MATERIALS.map(slug => ({
    url: `${base}/browse/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const cityPages = CITIES.map(city => ({
    url: `${base}/${city}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const locationPages = CITIES.flatMap(city =>
    MATERIALS.map(material => ({
      url: `${base}/${city}/${material}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  )

  const learnPages = ARTICLES.map(slug => ({
    url: `${base}/learn/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...materialPages, ...cityPages, ...locationPages, ...learnPages]
}
