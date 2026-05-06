'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GallerySlide {
  id: string
  url: string
  alt: string | null
}

type Size = 'card' | 'detail'

interface Props {
  slides: GallerySlide[]
  name: string
  size?: Size
  className?: string
  priorityFirst?: boolean
}

const SIZES: Record<Size, string> = {
  card: '(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 320px',
  detail: '(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 720px',
}

export function MaterialGalleryCarousel({
  slides,
  name,
  size = 'detail',
  className,
  priorityFirst = false,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const scrollToIndex = useCallback((i: number) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setActive(i)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const hasMultiple = slides.length > 1

  return (
    <div className={cn('relative w-full select-none', className)}>
      <div
        ref={scrollerRef}
        className={cn(
          'flex aspect-square w-full overflow-x-auto rounded-xl bg-stone-100',
          'snap-x snap-mandatory scroll-smooth',
          '[&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
        )}
        aria-roledescription="carousel"
        aria-label={`${name} images`}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className="relative aspect-square w-full flex-none snap-center"
            aria-roledescription="slide"
            aria-label={`Image ${idx + 1} of ${slides.length}`}
          >
            <Image
              src={slide.url}
              alt={slide.alt ?? name}
              fill
              sizes={SIZES[size]}
              className="object-cover"
              priority={priorityFirst && idx === 0}
              quality={85}
            />
          </div>
        ))}
      </div>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(Math.max(0, active - 1))}
            disabled={active === 0}
            aria-label="Previous image"
            className={cn(
              'absolute left-2 top-1/2 hidden -translate-y-1/2 md:grid',
              'size-9 place-items-center rounded-full bg-white/90 shadow-md',
              'transition-opacity hover:bg-white disabled:opacity-30',
            )}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(Math.min(slides.length - 1, active + 1))}
            disabled={active === slides.length - 1}
            aria-label="Next image"
            className={cn(
              'absolute right-2 top-1/2 hidden -translate-y-1/2 md:grid',
              'size-9 place-items-center rounded-full bg-white/90 shadow-md',
              'transition-opacity hover:bg-white disabled:opacity-30',
            )}
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === active ? 'true' : 'false'}
                className={cn(
                  'h-1.5 rounded-full bg-white/80 shadow transition-all',
                  i === active ? 'w-5' : 'w-1.5 bg-white/50',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
