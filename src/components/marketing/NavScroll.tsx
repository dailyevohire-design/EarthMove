'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Sticks v6's nav with `.scrolled` class when window.scrollY > 4.
 * Wraps the <header id="nav"> markup so the scroll listener can toggle the class.
 */
export function NavScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return
      ref.current.classList.toggle('scrolled', window.scrollY > 4)
    }
    document.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header id="nav" ref={ref} className="nav">
      {children}
    </header>
  )
}
