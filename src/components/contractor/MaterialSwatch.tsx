type Props = {
  slug: string | null | undefined
  size?: number
}

// Keys roughly to the material family in the slug. Extend as needed.
function colorFor(slug: string | null | undefined): string {
  if (!slug) return 'var(--ink-300)'
  const s = slug.toLowerCase()
  if (s.includes('topsoil'))   return 'var(--earth-500)'
  if (s.includes('fill') || s.includes('dirt')) return 'var(--earth-700)'
  if (s.includes('base') || s.includes('crushed')) return 'var(--safety-600)'
  if (s.includes('sand'))      return 'var(--clay-500)'
  if (s.includes('gravel') || s.includes('pea-gravel') || s.includes('rip-rap')) return 'var(--ink-500)'
  if (s.includes('mulch') || s.includes('compost') || s.includes('organic')) return 'var(--earth-600)'
  if (s.includes('recycled'))  return 'var(--clay-600)'
  return 'var(--ink-300)'
}

export function MaterialSwatch({ slug, size = 14 }: Props) {
  return (
    <span
      className="ec-swatch"
      aria-hidden
      style={{ width: size, height: size, background: colorFor(slug) }}
    />
  )
}

export { colorFor as materialColor }
