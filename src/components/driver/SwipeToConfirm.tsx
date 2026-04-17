'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  gloveMode?: boolean       // scales thumb from 60 → 72pt, taller bar via .glove ancestor class
  threshold?: number        // fraction of max travel; default .85
  longPressMs?: number      // if > 0, require hold before swipe is armed (glove mode)
}

export function SwipeToConfirm({
  label, onConfirm, disabled,
  gloveMode = false, threshold = 0.85, longPressMs = 0,
}: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const fillRef  = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)
  const [busy,  setBusy]  = useState(false)

  const startX   = useRef(0)
  const currentX = useRef(0)
  const dragging = useRef(false)
  const pressTs  = useRef(0)

  const thumbW = gloveMode ? 72 : 60

  const reset = useCallback(() => {
    const t = thumbRef.current, f = fillRef.current
    if (!t || !f) return
    t.style.transition = ''
    f.style.transition = ''
    t.style.width = thumbW + 'px'
    f.style.width = thumbW + 'px'
    currentX.current = 0
    setArmed(false)
  }, [thumbW])

  useEffect(() => { reset() }, [reset])

  const getMax = () => (wrapRef.current ? wrapRef.current.offsetWidth - thumbW - 12 : 0)

  const pointerX = (e: PointerEvent | TouchEvent) => {
    if ('clientX' in e) return (e as PointerEvent).clientX
    const t = (e as TouchEvent).touches[0]
    return t?.clientX ?? 0
  }

  const onDown = (e: React.PointerEvent | React.TouchEvent) => {
    if (disabled || busy) return
    dragging.current = true
    pressTs.current  = Date.now()
    startX.current   = 'clientX' in e ? e.clientX : (e as React.TouchEvent).touches[0].clientX
    const t = thumbRef.current, f = fillRef.current
    if (t) t.style.transition = 'none'
    if (f) f.style.transition = 'none'
    ;(e.target as Element).setPointerCapture?.((e as any).pointerId)
  }

  const onMove = (e: PointerEvent | TouchEvent) => {
    if (!dragging.current) return
    if (longPressMs > 0 && Date.now() - pressTs.current < longPressMs) return
    const max = getMax()
    const dx  = pointerX(e) - startX.current
    currentX.current = Math.max(0, Math.min(max, dx))
    const w = thumbW + currentX.current
    if (thumbRef.current) thumbRef.current.style.width = w + 'px'
    if (fillRef.current)  fillRef.current.style.width  = w + 'px'
    setArmed(currentX.current > max * threshold)
    if (e.cancelable) e.preventDefault()
  }

  const onUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const t = thumbRef.current, f = fillRef.current
    if (t) t.style.transition = ''
    if (f) f.style.transition = ''
    const max = getMax()
    if (currentX.current > max * threshold) {
      if (t) t.style.width = (wrapRef.current!.offsetWidth - 12) + 'px'
      if (f) f.style.width = (wrapRef.current!.offsetWidth - 12) + 'px'
      setBusy(true)
      Promise.resolve(onConfirm()).finally(() => {
        setBusy(false)
        setTimeout(reset, 180)
      })
    } else {
      reset()
    }
  }

  useEffect(() => {
    const m = (e: PointerEvent | TouchEvent) => onMove(e)
    const u = () => onUp()
    window.addEventListener('pointermove', m)
    window.addEventListener('pointerup',   u)
    window.addEventListener('touchmove',   m, { passive: false })
    window.addEventListener('touchend',    u)
    return () => {
      window.removeEventListener('pointermove', m)
      window.removeEventListener('pointerup',   u)
      window.removeEventListener('touchmove',   m as any)
      window.removeEventListener('touchend',    u)
    }
  })

  return (
    <div
      ref={wrapRef}
      className={`em-swipe ${armed ? 'armed' : ''}`}
      onPointerDown={onDown as any}
      onTouchStart={onDown as any}
      aria-disabled={disabled || busy}
    >
      <div ref={fillRef}  className="em-swipe__fill" />
      <div className="em-swipe__track"><span>{label}</span></div>
      <div ref={thumbRef} className="em-swipe__thumb">
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  )
}
