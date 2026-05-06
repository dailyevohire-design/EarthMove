/**
 * Hero images for /learn articles.
 *
 * Articles aren't migrated to a DB-backed image system (catalog photos are —
 * see material_images + material_catalog.image_url). Keeping a slug→URL map
 * here is fine until articles get a DB-backed gallery of their own.
 */

export const ARTICLE_IMAGES: Record<string, string> = {
  // ── V2 canonical slugs (current as of 2026-04 redesign) ──
  'driveway-gravel-complete-guide-2026': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'best-materials-french-drains': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=1200&q=80',
  'aggregate-grades-explained-57-67-flex-base': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'cubic-yards-calculator': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'three-thousand-dollar-mistake': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=1200&q=80',

  // ── Legacy slugs (kept for SEO continuity) ──
  'driveway-gravel-guide': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'fill-dirt-vs-topsoil': 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=1200&q=80',
  'french-drain-materials': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=1200&q=80',
  'how-much-gravel-do-i-need': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'gravel-calculator': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'material-grades-explained': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'ordering-wrong-material': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=1200&q=80',
}

export function getArticleImage(slug: string): string {
  return ARTICLE_IMAGES[slug] || ARTICLE_IMAGES['fill-dirt-vs-topsoil']
}
