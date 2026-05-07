'use client'
import { useEffect } from 'react'

export function SetProjectIntent({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `project_intent=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
  }, [slug])
  return null
}
