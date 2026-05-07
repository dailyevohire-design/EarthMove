import { createClient } from '@/lib/supabase/server'
import { MaterialGalleryCarousel } from './material-gallery-carousel'
import { MaterialImagePlaceholder } from './MaterialImagePlaceholder'

export type MaterialGallerySize = 'card' | 'detail'

interface Props {
  slug: string
  size?: MaterialGallerySize
  className?: string
  /** Mark the first image priority (true on PDP hero, false in grids) */
  priorityFirst?: boolean
  /** Offering-level photo to prepend ahead of the catalog gallery (A+B model). */
  priorityImageUrl?: string | null
  priorityImageAlt?: string | null
}

export async function MaterialGallery({
  slug,
  size = 'detail',
  className,
  priorityFirst = false,
  priorityImageUrl,
  priorityImageAlt,
}: Props) {
  const sb = await createClient()

  const { data: material } = await sb
    .from('material_catalog')
    .select('id, name, image_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!material) return null

  const { data: images } = await sb
    .from('material_images')
    .select('id, url, alt, is_primary, sort_order')
    .eq('material_catalog_id', material.id)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true })

  const gallerySlides =
    images && images.length > 0
      ? images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? material.name }))
      : material.image_url
        ? [{ id: 'fallback', url: material.image_url, alt: material.name }]
        : []

  const slides = priorityImageUrl
    ? [
        { id: 'priority', url: priorityImageUrl, alt: priorityImageAlt ?? material.name },
        ...gallerySlides.filter((s) => s.url !== priorityImageUrl),
      ]
    : gallerySlides

  if (slides.length === 0) {
    return (
      <div className={`relative w-full aspect-square overflow-hidden rounded-xl bg-stone-100 ${className ?? ''}`}>
        <MaterialImagePlaceholder label="Product image coming soon" markSize={64} />
      </div>
    )
  }

  return (
    <MaterialGalleryCarousel
      slides={slides}
      name={material.name}
      size={size}
      className={className}
      priorityFirst={priorityFirst}
    />
  )
}
