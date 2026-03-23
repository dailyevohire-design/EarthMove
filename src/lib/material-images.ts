/**
 * PERMANENT IMAGE LOOKUP — hardcoded, never breaks, no database dependency.
 * If database has an image, great. If not, this is the guaranteed fallback.
 */

export const MATERIAL_IMAGES: Record<string, string> = {
  'fill-dirt': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'select-fill': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
  'topsoil': 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
  'concrete-sand': 'https://images.unsplash.com/photo-1531496730074-83b227aab3e3?w=800&q=80',
  'masonry-sand': 'https://images.unsplash.com/photo-1527710527668-9e3d26d7cf82?w=800&q=80',
  'utility-sand': 'https://images.unsplash.com/photo-1547708915-f4a7dfe50bdf?w=800&q=80',
  'pea-gravel': 'https://images.unsplash.com/photo-1558905586-b023c5dd4182?w=800&q=80',
  'base-gravel-57': 'https://images.unsplash.com/photo-1615811361523-1ba6a72fc1a3?w=800&q=80',
  'flex-base': 'https://images.unsplash.com/photo-1590587521606-3394a0a1815a?w=800&q=80',
  'road-base': 'https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&q=80',
  'washed-river-rock': 'https://images.unsplash.com/photo-1567095761054-7003d35e5350?w=800&q=80',
  'limestone': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80',
  'rip-rap': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80',
  'crushed-concrete': 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80',
  'decomposed-granite': 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80',
}

export const ARTICLE_IMAGES: Record<string, string> = {
  'driveway-gravel-guide': 'https://images.unsplash.com/photo-1558618047-3c37c2d3b4b0?w=1200&q=80',
  'fill-dirt-vs-topsoil': 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
  'french-drain-materials': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
  'how-much-gravel-do-i-need': 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80',
  'spring-project-guide-2025': 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
  'gravel-calculator': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',
  'material-grades-explained': 'https://images.unsplash.com/photo-1615811361523-1ba6a72fc1a3?w=1200&q=80',
  'ordering-wrong-material': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',
}

export function getMaterialImage(slug: string): string {
  return MATERIAL_IMAGES[slug] || MATERIAL_IMAGES['fill-dirt']
}

export function getArticleImage(slug: string): string {
  return ARTICLE_IMAGES[slug] || ARTICLE_IMAGES['fill-dirt-vs-topsoil']
}
