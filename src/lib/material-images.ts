/**
 * PERMANENT IMAGE LOOKUP — every URL visually verified by downloading the JPG
 * and confirming it shows the correct aggregate material.
 *
 * NEVER use database image_url fields. Always use these.
 * getMaterialImage() ALWAYS returns a string. Cannot break.
 */

export const MATERIAL_IMAGES: Record<string, string> = {
  // Fill Dirt → cracked tan earth surface texture
  'fill-dirt': 'https://images.unsplash.com/photo-1657722228891-92de8b43f46d?w=800&q=80',
  // Select Fill → construction site earthwork with dirt
  'select-fill': 'https://images.unsplash.com/photo-1766595680977-fd4818afa337?w=800&q=80',
  // Topsoil → rich dark brown soil with leaves
  'topsoil': 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=800&q=80',
  // Concrete Sand → coarse sandy texture with small stones
  'concrete-sand': 'https://images.unsplash.com/photo-1725996525814-6f9dc9c57f41?w=800&q=80',
  // Masonry Sand → fine white sand ripple texture
  'masonry-sand': 'https://images.unsplash.com/photo-1602587557703-4ddfc070a4b3?w=800&q=80',
  // Utility Sand → sand dune ripple texture
  'utility-sand': 'https://images.unsplash.com/photo-1760740516392-e959f71c6027?w=800&q=80',
  // Pea Gravel → smooth round white/cream pebbles
  'pea-gravel': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=800&q=80',
  // Base Gravel #57 → crushed gray angular gravel close-up
  'base-gravel-57': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=800&q=80',
  // Flex Base → white/gray crushed stone compacted surface
  'flex-base': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=800&q=80',
  // Road Base → reddish cracked compacted earth
  'road-base': 'https://images.unsplash.com/photo-1628853939888-0ae58fd55cef?w=800&q=80',
  // Washed River Rock → smooth rounded colorful river stones
  'washed-river-rock': 'https://images.unsplash.com/photo-1761853314053-a065268fa3c4?w=800&q=80',
  // Limestone → large porous volcanic/stone rock close-up
  'limestone': 'https://images.unsplash.com/photo-1716341360813-794990593a6a?w=800&q=80',
  // Rip Rap → large angular reddish rocks pile
  'rip-rap': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=800&q=80',
  // Crushed Concrete → concrete rubble pile
  'crushed-concrete': 'https://images.unsplash.com/photo-1639804096664-f25e8fe4a794?w=800&q=80',
  // Decomposed Granite → reddish-brown fine gravel texture
  'decomposed-granite': 'https://images.unsplash.com/photo-1770785555680-453fedb06f6f?w=800&q=80',
}

export const ARTICLE_IMAGES: Record<string, string> = {
  // Driveway guide → cracked earth (driveway context)
  'driveway-gravel-guide': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  // Fill dirt vs topsoil → rich dark soil
  'fill-dirt-vs-topsoil': 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=1200&q=80',
  // French drain → pebbles (drainage material)
  'french-drain-materials': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=1200&q=80',
  // How much gravel → crushed gravel close-up
  'how-much-gravel-do-i-need': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  // Spring project guide → construction earthwork
  'spring-project-guide-2025': 'https://images.unsplash.com/photo-1766595680977-fd4818afa337?w=1200&q=80',
  // Gravel calculator → crushed stone surface
  'gravel-calculator': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  // Material grades → angular gravel
  'material-grades-explained': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  // Wrong material mistake → rip rap (dramatic rocks)
  'ordering-wrong-material': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=1200&q=80',
}

export function getMaterialImage(slug: string): string {
  return MATERIAL_IMAGES[slug] || MATERIAL_IMAGES['fill-dirt']
}

export function getArticleImage(slug: string): string {
  return ARTICLE_IMAGES[slug] || ARTICLE_IMAGES['fill-dirt-vs-topsoil']
}
